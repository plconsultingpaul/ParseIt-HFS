// index.ts - Main workflow orchestrator (refactored)

import { corsHeaders, getValueByPath, createStepLog } from "./utils.ts";
import { executeApiCall, executeApiEndpoint } from "./steps/api.ts";
import { executeEmailAction } from "./steps/email.ts";
import { executeConditionalCheck, executeJsonTransform, executeRename } from "./steps/logic.ts";
import { executeSftpUpload } from "./steps/upload.ts";
import { sendSuccessNotificationIfEnabled, sendFailureNotificationIfEnabled } from "./steps/notifications.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  console.log('🚀 === JSON WORKFLOW PROCESSOR START ===');
  let workflowExecutionLogId: string | null = null;
  let extractionLogId: string | null = null;
  let requestData: any;
  let contextData: any;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase configuration missing');
      return new Response(JSON.stringify({ error: "Supabase configuration missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log('✅ Supabase configuration loaded');

    // Parse request
    try {
      console.log('📥 Reading request body...');
      const requestText = await req.text();
      console.log('📏 Request body size:', requestText.length, 'characters');

      if (!requestText || requestText.trim() === '') {
        throw new Error('Request body is empty');
      }

      console.log('🔧 Parsing request JSON...');
      requestData = JSON.parse(requestText);
      console.log('✅ Request parsed successfully');
      console.log('🔑 Request keys:', Object.keys(requestData));
    } catch (parseError) {
      console.error('❌ Failed to parse request:', parseError);
      return new Response(JSON.stringify({
        error: "Invalid request format",
        details: parseError instanceof Error ? parseError.message : "Unknown parse error"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log('📊 Workflow ID:', requestData.workflowId);
    console.log('👤 User ID:', requestData.userId || 'none');
    console.log('📄 PDF filename:', requestData.pdfFilename);
    console.log('🎯 Trigger source:', requestData.triggerSource || 'manual');

    const triggerSource = requestData.triggerSource || 'manual';

    // Fetch type details
    console.log('🔍 === FETCHING TYPE DETAILS ===');
    let typeDetails = null;
    let formatType = 'JSON';

    try {
      if (requestData.extractionTypeId) {
        console.log('📋 Fetching extraction type details for ID:', requestData.extractionTypeId);
        const extractionTypeResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_types?id=eq.${requestData.extractionTypeId}`, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          }
        });

        if (extractionTypeResponse.ok) {
          const extractionTypes = await extractionTypeResponse.json();
          if (extractionTypes && extractionTypes.length > 0) {
            typeDetails = extractionTypes[0];
            formatType = typeDetails.format_type || 'JSON';
            console.log('✅ Extraction type details loaded, formatType:', formatType);
          }
        }
      } else if (requestData.transformationTypeId) {
        console.log('📋 Fetching transformation type details for ID:', requestData.transformationTypeId);
        const transformationTypeResponse = await fetch(`${supabaseUrl}/rest/v1/transformation_types?id=eq.${requestData.transformationTypeId}`, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          }
        });

        if (transformationTypeResponse.ok) {
          const transformationTypes = await transformationTypeResponse.json();
          if (transformationTypes && transformationTypes.length > 0) {
            typeDetails = transformationTypes[0];
            formatType = typeDetails.format_type || 'JSON';
            console.log('✅ Transformation type details loaded');
          }
        }
      }

      console.log('📊 Type details loaded:', !!typeDetails);
      console.log('📊 Format type determined:', formatType);
    } catch (typeError) {
      console.error('❌ Failed to fetch type details:', typeError);
      console.log('⚠️ Continuing with default formatType: JSON');
    }

    // Create extraction log (skip if already provided by email-monitor)
    if (requestData.extractionLogId) {
      extractionLogId = requestData.extractionLogId;
      console.log('📝 Using existing extraction log ID from email-monitor:', extractionLogId);
    } else {
      console.log('📝 Creating extraction log entry...');
      try {
        const extractionLogResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_logs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            user_id: requestData.userId || null,
            extraction_type_id: requestData.extractionTypeId || null,
            transformation_type_id: requestData.transformationTypeId || null,
            pdf_filename: requestData.originalPdfFilename,
            pdf_pages: requestData.pdfPages,
            extraction_status: 'success',
            extracted_data: requestData.extractedData || null,
            processing_mode: requestData.transformationTypeId ? 'transformation' : 'extraction',
            created_at: new Date().toISOString()
          })
        });

        if (extractionLogResponse.ok) {
          const extractionLogData = await extractionLogResponse.json();
          extractionLogId = extractionLogData[0]?.id;
          console.log('✅ Extraction log created with ID:', extractionLogId);
        } else {
          console.error('❌ Failed to create extraction log:', extractionLogResponse.status);
        }
      } catch (logError) {
        console.error('❌ Error creating extraction log:', logError);
      }
    }

    // Create workflow execution log
    console.log('📝 Creating workflow execution log...');
    try {
      const workflowLogPayload = {
        extraction_log_id: extractionLogId,
        workflow_id: requestData.workflowId,
        status: 'running',
        context_data: {},
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const workflowLogResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(workflowLogPayload)
      });

      if (workflowLogResponse.ok) {
        const responseText = await workflowLogResponse.text();
        if (responseText && responseText.trim() !== '') {
          try {
            const workflowLogData = JSON.parse(responseText);
            workflowExecutionLogId = workflowLogData[0]?.id;
            console.log('✅ Workflow execution log created with ID:', workflowExecutionLogId);
          } catch (parseError) {
            console.error('❌ Failed to parse workflow log response:', parseError);
            console.log('⚠️ Continuing without workflow execution log ID');
          }
        }
      } else {
        const errorText = await workflowLogResponse.text();
        console.error('❌ Failed to create workflow execution log:', workflowLogResponse.status, errorText);
        console.log('⚠️ Continuing without workflow execution log');
      }
    } catch (logError) {
      console.error('❌ Error creating workflow execution log:', logError);
      console.log('⚠️ Continuing without workflow execution log');
    }

    // Load extracted data
    let extractedData: any = {};
    console.log('📁 === LOADING EXTRACTED DATA ===');

    if (requestData.extractedDataStoragePath) {
      console.log('📁 Loading from storage path:', requestData.extractedDataStoragePath);
      try {
        const storageUrl = `${supabaseUrl}/storage/v1/object/pdfs/${requestData.extractedDataStoragePath}`;
        const storageResponse = await fetch(storageUrl, {
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}` }
        });

        if (!storageResponse.ok) {
          const errorText = await storageResponse.text();
          console.error('📁 Storage fetch failed:', errorText);
          throw new Error(`Storage fetch failed: ${storageResponse.status} - ${errorText}`);
        }

        const storageText = await storageResponse.text();
        if (!storageText || storageText.trim() === '') {
          console.warn('⚠️ Storage file is empty, using empty object');
          extractedData = {};
        } else {
          extractedData = JSON.parse(storageText);
          console.log('✅ Successfully parsed extracted data from storage');
        }
      } catch (storageError) {
        console.error('❌ Storage loading error:', storageError);
        extractedData = {};
      }
    } else if (requestData.extractedData) {
      console.log('📊 Processing extracted data from request...');
      try {
        if (typeof requestData.extractedData === 'string') {
          if (requestData.extractedData.trim() === '') {
            extractedData = {};
          } else if (formatType === 'CSV') {
            extractedData = requestData.extractedData;
            console.log('✅ CSV data preserved as string');
          } else {
            extractedData = JSON.parse(requestData.extractedData);
            console.log('✅ Parsed extracted data from request');
          }
        } else {
          extractedData = requestData.extractedData || {};
        }
      } catch (parseError) {
        console.error('❌ Failed to parse extracted data:', parseError);
        if (formatType === 'CSV' && typeof requestData.extractedData === 'string') {
          extractedData = requestData.extractedData;
        } else {
          extractedData = {};
        }
      }
    }

    // Fetch workflow steps
    console.log('📋 Fetching workflow steps...');
    const stepsResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_steps?workflow_id=eq.${requestData.workflowId}&order=step_order.asc`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    });

    if (!stepsResponse.ok) {
      throw new Error('Failed to fetch workflow steps');
    }

    const steps = await stepsResponse.json();
    console.log('📊 Found', steps.length, 'workflow steps');

    if (steps.length === 0) {
      throw new Error('No steps found in workflow');
    }

    // Parse workflow-only data
    let workflowOnlyFields: any = {};
    if (requestData.workflowOnlyData) {
      try {
        workflowOnlyFields = typeof requestData.workflowOnlyData === 'string'
          ? JSON.parse(requestData.workflowOnlyData)
          : requestData.workflowOnlyData;
        console.log('📊 Parsed workflow-only data:', workflowOnlyFields);
      } catch (error) {
        console.warn('⚠️ Failed to parse workflowOnlyData:', error);
        workflowOnlyFields = {};
      }
    }

    // Initialize context data (Sprint 1: Added senderEmail and extractionTypeName)
    // Format timestamp at source in PST format for all workflow steps to use
    const formattedTimestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    console.log('🕐 Workflow timestamp (PST):', formattedTimestamp);

    contextData = {
      extractedData: extractedData,
      originalExtractedData: requestData.extractedData,
      formatType: formatType,
      pdfFilename: requestData.extractionTypeFilename || requestData.pdfFilename,
      originalPdfFilename: requestData.originalPdfFilename,
      extractionTypeFilename: typeDetails?.filename_template || requestData.extractionTypeFilename,
      pdfStoragePath: requestData.pdfStoragePath,
      pdfBase64: requestData.pdfBase64,
      userId: requestData.userId,
      senderEmail: requestData.senderEmail || null,
      extractionTypeName: typeDetails?.name || 'Unknown',
      timestamp: formattedTimestamp,
      ...workflowOnlyFields
    };

    if (formatType !== 'CSV' && typeof extractedData === 'object' && extractedData !== null) {
      contextData = { ...contextData, ...extractedData };
      console.log('📊 Context data merged with extracted data object');
    }

    console.log('🔄 Starting workflow execution with', steps.length, 'steps...');
    let lastApiResponse: any = null;

    // Main workflow execution loop
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStartTime = new Date().toISOString();
      const stepStartMs = Date.now();

      console.log(`\n🔄 === EXECUTING STEP ${step.step_order}: ${step.step_name} ===`);
      console.log('🔧 Step type:', step.step_type);
      console.log('🔧 Step ID:', step.id);

      let stepInputData: any = { config: step.config_json };
      let stepOutputData: any = null;

      try {
        // Update workflow log with current step
        await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            current_step_id: step.id,
            current_step_name: step.step_name,
            context_data: contextData,
            updated_at: new Date().toISOString()
          })
        });

        const config = step.config_json || {};
        let shouldSkipStep = false;
        let skipReason = '';

        // Check skipIf condition
        if (config.skipIf) {
          console.log('🔍 Checking skipIf condition:', config.skipIf);
          const conditionResult = getValueByPath(contextData, config.skipIf);
          if (conditionResult === true) {
            shouldSkipStep = true;
            skipReason = `skipIf condition met: ${config.skipIf} = true`;
            console.log(`⏭️ Skipping step ${step.step_order} (${step.step_name}): ${skipReason}`);
          }
        }

        // Check runIf condition
        if (!shouldSkipStep && config.runIf) {
          console.log('🔍 Checking runIf condition:', config.runIf);
          const conditionResult = getValueByPath(contextData, config.runIf);
          if (conditionResult !== true) {
            shouldSkipStep = true;
            skipReason = `runIf condition not met: ${config.runIf} = ${conditionResult}`;
            console.log(`⏭️ Skipping step ${step.step_order} (${step.step_name}): ${skipReason}`);
          }
        }

        // Skip notification email steps when triggered manually (not from email monitoring)
        if (!shouldSkipStep && step.step_type === 'email_action' && step.config_json?.isNotificationEmail === true && triggerSource === 'manual') {
          shouldSkipStep = true;
          skipReason = 'Notification email steps only run when triggered by email monitoring';
          console.log(`⏭️ Skipping step ${step.step_order} (${step.step_name}): ${skipReason}`);
        }

        if (shouldSkipStep) {
          stepOutputData = { skipped: true, reason: skipReason, conditionalSkip: true };
          const stepEndTime = new Date().toISOString();
          const stepDurationMs = Date.now() - stepStartMs;

          if (workflowExecutionLogId) {
            await createStepLog(supabaseUrl, supabaseServiceKey, workflowExecutionLogId, requestData.workflowId, step, 'skipped', stepStartTime, stepEndTime, stepDurationMs, skipReason, stepInputData, stepOutputData);
          }
          continue;
        }

        // Execute step based on type
        switch (step.step_type) {
          case 'api_call':
            stepOutputData = await executeApiCall(step, contextData);
            lastApiResponse = stepOutputData;
            break;

          case 'api_endpoint':
            stepOutputData = await executeApiEndpoint(step, contextData, supabaseUrl, supabaseServiceKey);
            lastApiResponse = stepOutputData;
            break;

          case 'email_action':
            stepOutputData = await executeEmailAction(step, contextData, supabaseUrl, supabaseServiceKey);
            break;

          case 'sftp_upload':
          case 'csv_upload':
          case 'json_upload':
            stepOutputData = await executeSftpUpload(step, contextData, supabaseUrl, supabaseServiceKey, formatType);
            break;

          case 'conditional_check':
            stepOutputData = await executeConditionalCheck(step, contextData);

            // Handle conditional branching
            if (stepOutputData.conditionMet) {
              const nextStepId = step.next_step_on_success_id;
              if (nextStepId) {
                console.log(`🔀 Conditional branch: conditionMet=true, jumping to step ID: ${nextStepId}`);
                const targetIndex = steps.findIndex((s: any) => s.id === nextStepId);
                if (targetIndex !== -1) {
                  i = targetIndex - 1;
                }
              }
            } else {
              const nextStepId = step.next_step_on_failure_id;
              if (nextStepId) {
                console.log(`🔀 Conditional branch: conditionMet=false, jumping to step ID: ${nextStepId}`);
                const targetIndex = steps.findIndex((s: any) => s.id === nextStepId);
                if (targetIndex !== -1) {
                  i = targetIndex - 1;
                }
              }
            }
            break;

          case 'rename_file':
          case 'rename_pdf':
            stepOutputData = await executeRename(step, contextData, formatType, lastApiResponse);
            break;

          case 'json_transform':
            stepOutputData = await executeJsonTransform(step, contextData);
            break;

          default:
            console.warn(`⚠️ Unknown step type: ${step.step_type}`);
            throw new Error(`Unknown step type: ${step.step_type}`);
        }

        // Log successful step completion
        const stepEndTime = new Date().toISOString();
        const stepDurationMs = Date.now() - stepStartMs;
        console.log(`✅ Step ${step.step_order} completed successfully in ${stepDurationMs}ms`);

        if (workflowExecutionLogId) {
          await createStepLog(supabaseUrl, supabaseServiceKey, workflowExecutionLogId, requestData.workflowId, step, 'completed', stepStartTime, stepEndTime, stepDurationMs, null, stepInputData, stepOutputData);
        }

      } catch (stepError) {
        console.error(`❌ Step ${step.step_order} failed:`, stepError);
        const stepEndTime = new Date().toISOString();
        const stepDurationMs = Date.now() - stepStartMs;
        const errorMessage = stepError instanceof Error ? stepError.message : 'Unknown error';

        if (workflowExecutionLogId) {
          await createStepLog(supabaseUrl, supabaseServiceKey, workflowExecutionLogId, requestData.workflowId, step, 'failed', stepStartTime, stepEndTime, stepDurationMs, errorMessage, stepInputData, null);
        }

        throw stepError;
      }
    }

    // Workflow completed successfully
    console.log('✅ === WORKFLOW COMPLETED SUCCESSFULLY ===');
    if (workflowExecutionLogId) {
      await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    }

    // Sprint 1: Send success notification if enabled
    if (requestData.extractionTypeId) {
      try {
        await sendSuccessNotificationIfEnabled(
          supabaseUrl,
          supabaseServiceKey,
          requestData.extractionTypeId,
          contextData,
          workflowExecutionLogId
        );
      } catch (notificationError) {
        console.error('⚠️ Success notification failed (non-fatal):', notificationError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      extractionLogId: extractionLogId,
      workflowExecutionLogId: workflowExecutionLogId,
      finalContext: contextData
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ === WORKFLOW EXECUTION ERROR ===');
    console.error('❌ Error type:', error?.constructor?.name);
    console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (workflowExecutionLogId && supabaseUrl && supabaseServiceKey) {
      await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    }

    // Sprint 1: Send failure notification if enabled
    if (requestData?.extractionTypeId && supabaseUrl && supabaseServiceKey) {
      try {
        await sendFailureNotificationIfEnabled(
          supabaseUrl,
          supabaseServiceKey,
          requestData.extractionTypeId,
          error instanceof Error ? error.message : 'Unknown error',
          typeof contextData !== 'undefined' ? contextData : {
            senderEmail: requestData?.senderEmail,
            originalPdfFilename: requestData?.originalPdfFilename || requestData?.pdfFilename,
            pdfBase64: requestData?.pdfBase64,
            extractionTypeName: 'Unknown'
          },
          workflowExecutionLogId
        );
      } catch (notificationError) {
        console.error('⚠️ Failure notification failed (non-fatal):', notificationError);
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      extractionLogId: extractionLogId,
      workflowExecutionLogId: workflowExecutionLogId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});