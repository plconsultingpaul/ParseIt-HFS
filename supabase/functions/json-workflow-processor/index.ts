import { Buffer } from "node:buffer";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};
function filterJsonWorkflowOnlyFields(data, fieldMappings) {
  if (!data || !fieldMappings || fieldMappings.length === 0) {
    return data;
  }
  try {
    const outputFields = fieldMappings.filter((m)=>!m.isWorkflowOnly);
    const outputFieldNames = outputFields.map((m)=>m.fieldName);
    const workflowOnlyCount = fieldMappings.length - outputFields.length;
    console.log(`📊 JSON Filtering: Keeping ${outputFields.length} fields, excluding ${workflowOnlyCount} workflow-only fields`);
    if (workflowOnlyCount === 0) {
      console.log('📊 No workflow-only fields to filter, using original data');
      return data;
    }
    const filterObject = (obj)=>{
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) {
        return obj.map((item)=>filterObject(item));
      }
      const filtered = {};
      for (const key of Object.keys(obj)){
        if (outputFieldNames.includes(key)) {
          filtered[key] = obj[key];
        }
      }
      return filtered;
    };
    const filteredData = filterObject(data);
    console.log(`✅ JSON filtered successfully: ${outputFields.length} fields kept`);
    return filteredData;
  } catch (error) {
    console.error('❌ Error filtering JSON workflow-only fields:', error);
    console.log('⚠️ Returning original data');
    return data;
  }
}
async function createStepLog(supabaseUrl, supabaseServiceKey, workflowExecutionLogId, workflowId, step, status, startedAt, completedAt, durationMs, errorMessage, inputData, outputData) {
  try {
    const stepLogPayload = {
      workflow_execution_log_id: workflowExecutionLogId,
      workflow_id: workflowId,
      step_id: step.id,
      step_name: step.step_name,
      step_type: step.step_type,
      step_order: step.step_order,
      status,
      started_at: startedAt,
      completed_at: completedAt || null,
      duration_ms: durationMs || null,
      error_message: errorMessage || null,
      input_data: inputData || null,
      output_data: outputData || null,
      created_at: new Date().toISOString()
    };
    const stepLogResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_step_logs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(stepLogPayload)
    });
    if (stepLogResponse.ok) {
      const stepLogData = await stepLogResponse.json();
      console.log(`✅ Step log created for step ${step.step_order}:`, stepLogData[0]?.id);
      return stepLogData[0]?.id;
    } else {
      console.error('❌ Failed to create step log:', stepLogResponse.status);
    }
  } catch (error) {
    console.error('❌ Error creating step log:', error);
  }
  return null;
}
// === DIAGNOSTIC START: Helper Function ===
function getValueByPath(obj, path) {
  try {
    if (!obj || !path) return undefined;
    const parts = path.split(/[.\[\]]/).filter(Boolean);
    let current = obj;
    for (const part of parts){
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }
    return current;
  } catch (error) {
    console.error('DIAGNOSTIC ERROR: getValueByPath failed:', error);
    return undefined;
  }
}
// === DIAGNOSTIC END: Helper Function ===
// === Helper Function: Escape Single Quotes for OData ===
function escapeSingleQuotesForOData(value) {
  if (typeof value !== 'string') {
    return value;
  }
  // Replace single quote with double single quote for OData filter compatibility
  // Also replace )( with )-( to avoid WAF pattern detection
  return value.replace(/'/g, "''").replace(/\)\(/g, ')-(');
}
// === END: Helper Function ===
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  console.log('🚀 === JSON WORKFLOW PROCESSOR START ===');
  let workflowExecutionLogId = null;
  let extractionLogId = null;
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase configuration missing');
      return new Response(JSON.stringify({
        error: "Supabase configuration missing"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log('✅ Supabase configuration loaded');
    let requestData;
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
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    console.log('📊 Workflow ID:', requestData.workflowId);
    console.log('👤 User ID:', requestData.userId || 'none');
    console.log('📄 PDF filename:', requestData.pdfFilename);
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
      console.log('📝 Workflow log payload:', JSON.stringify(workflowLogPayload, null, 2));
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
      console.log('📝 Workflow log response status:', workflowLogResponse.status);
      console.log('📝 Workflow log response ok:', workflowLogResponse.ok);
      if (workflowLogResponse.ok) {
        const responseText = await workflowLogResponse.text();
        console.log('📝 Workflow log response text:', responseText);
        if (responseText && responseText.trim() !== '') {
          try {
            const workflowLogData = JSON.parse(responseText);
            console.log('📝 Parsed workflow log data:', workflowLogData);
            workflowExecutionLogId = workflowLogData[0]?.id;
            console.log('✅ Workflow execution log created with ID:', workflowExecutionLogId);
          } catch (parseError) {
            console.error('❌ Failed to parse workflow log response:', parseError);
            console.error('📝 Raw response that failed to parse:', responseText);
            console.log('⚠️ Continuing without workflow execution log ID');
          }
        } else {
          console.log('⚠️ Empty response from workflow log creation - continuing without log ID');
        }
      } else {
        const errorText = await workflowLogResponse.text();
        console.error('❌ Failed to create workflow execution log:', workflowLogResponse.status, errorText);
        console.log('⚠️ Continuing without workflow execution log');
      }
    } catch (logError) {
      console.error('❌ Error creating workflow execution log:', logError);
      console.error('❌ Log error type:', logError.constructor.name);
      console.error('❌ Log error message:', logError.message);
      console.log('⚠️ Continuing without workflow execution log');
    }
    let extractedData = {};
    console.log('📁 === LOADING EXTRACTED DATA ===');
    if (requestData.extractedDataStoragePath) {
      console.log('📁 Loading from storage path:', requestData.extractedDataStoragePath);
      try {
        const storageUrl = `${supabaseUrl}/storage/v1/object/pdfs/${requestData.extractedDataStoragePath}`;
        console.log('📁 Storage URL:', storageUrl);
        const storageResponse = await fetch(storageUrl, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });
        console.log('📁 Storage response status:', storageResponse.status);
        console.log('📁 Storage response ok:', storageResponse.ok);
        if (!storageResponse.ok) {
          const errorText = await storageResponse.text();
          console.error('📁 Storage fetch failed:', errorText);
          throw new Error(`Storage fetch failed: ${storageResponse.status} - ${errorText}`);
        }
        const storageText = await storageResponse.text();
        console.log('📁 Storage response length:', storageText.length);
        console.log('📁 Storage response preview (first 200):', storageText.substring(0, 200));
        console.log('📁 Storage response preview (last 100):', storageText.substring(Math.max(0, storageText.length - 100)));
        if (!storageText || storageText.trim() === '') {
          console.warn('⚠️ Storage file is empty, using empty object');
          extractedData = {};
        } else {
          console.log('📁 Attempting to parse storage content as JSON...');
          try {
            extractedData = JSON.parse(storageText);
            console.log('✅ Successfully parsed extracted data from storage');
            console.log('📊 Extracted data keys:', Object.keys(extractedData));
          } catch (storageParseError) {
            console.error('❌ Failed to parse storage JSON:', storageParseError);
            console.error('📁 Problematic content:', storageText);
            console.log('📁 Using empty object as fallback');
            extractedData = {};
          }
        }
      } catch (storageError) {
        console.error('❌ Storage loading error:', storageError);
        console.log('📁 Using empty object as fallback');
        extractedData = {};
      }
    } else if (requestData.extractedData) {
      console.log('📊 Processing extracted data from request...');
      console.log('📊 Format type:', formatType);
      try {
        if (typeof requestData.extractedData === 'string') {
          if (requestData.extractedData.trim() === '') {
            console.log('📊 Extracted data is empty string');
            extractedData = {};
          } else if (formatType === 'CSV') {
            console.log('📊 CSV format detected - keeping data as string');
            extractedData = requestData.extractedData;
            console.log('✅ CSV data preserved as string');
          } else {
            console.log('📊 Parsing extracted data string as JSON...');
            extractedData = JSON.parse(requestData.extractedData);
            console.log('✅ Parsed extracted data from request');
          }
        } else {
          console.log('📊 Using extracted data object directly');
          extractedData = requestData.extractedData || {};
        }
      } catch (parseError) {
        console.error('❌ Failed to parse extracted data:', parseError);
        if (formatType === 'CSV' && typeof requestData.extractedData === 'string') {
          console.log('📊 Parse failed but formatType is CSV - using raw string');
          extractedData = requestData.extractedData;
        } else {
          extractedData = {};
        }
      }
    } else {
      console.log('📊 No extracted data provided, using empty object');
      extractedData = {};
    }
    if (typeof extractedData === 'string') {
      console.log('📊 Final extracted data: CSV string with length', extractedData.length);
    } else {
      console.log('📊 Final extracted data keys:', Object.keys(extractedData));
    }
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
    console.log('📊 DEBUG - All steps loaded:');
    steps.forEach((step, index)=>{
      console.log(`  [${index}] Step ${step.step_order}: ${step.step_name} (type: ${step.step_type}, id: ${step.id})`);
    });
    if (steps.length === 0) {
      throw new Error('No steps found in workflow');
    }
    // Parse workflow-only data if provided
    let workflowOnlyFields = {};
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

    let contextData = {
      extractedData: extractedData,
      originalExtractedData: requestData.extractedData,
      formatType: formatType,
      pdfFilename: requestData.extractionTypeFilename || requestData.pdfFilename,
      originalPdfFilename: requestData.originalPdfFilename,
      extractionTypeFilename: typeDetails?.filename_template || requestData.extractionTypeFilename,
      pdfStoragePath: requestData.pdfStoragePath,
      pdfBase64: requestData.pdfBase64,
      userId: requestData.userId,
      ...workflowOnlyFields
    };
    if (formatType !== 'CSV' && typeof extractedData === 'object' && extractedData !== null) {
      contextData = {
        ...contextData,
        ...extractedData
      };
      console.log('📊 Context data merged with extracted data object');
    } else {
      console.log('📊 Context data created without spreading (CSV format or non-object data)');
    }
    console.log('📊 Workflow-only fields available in context:', Object.keys(workflowOnlyFields));
    // === DIAGNOSTIC START: Context Initialization ===
    try {
      console.log('DIAGNOSTIC: CONTEXT INITIALIZATION');
      console.log('DIAGNOSTIC: contextData.extractedData exists:', !!contextData.extractedData);
      console.log('DIAGNOSTIC: contextData.orders exists:', !!contextData.orders);
      if (contextData.extractedData && contextData.orders) {
        const refCheck = contextData.extractedData.orders === contextData.orders;
        console.log('DIAGNOSTIC: Reference Check:', refCheck ? 'SAME' : 'DIFFERENT');
      }
      const clientIdFromOrders = getValueByPath(contextData, 'orders[0].consignee.clientId');
      const clientIdFromExtracted = getValueByPath(contextData, 'extractedData.orders[0].consignee.clientId');
      console.log('DIAGNOSTIC: Initial contextData.orders[0]?.consignee?.clientId:', clientIdFromOrders);
      console.log('DIAGNOSTIC: Initial contextData.extractedData?.orders?.[0]?.consignee?.clientId:', clientIdFromExtracted);
    } catch (e) {
      console.error('DIAGNOSTIC ERROR: Context Initialization', e);
    }
    // === DIAGNOSTIC END: Context Initialization ===
    console.log('🔄 Starting workflow execution with', steps.length, 'steps...');
    console.log('🔄 DEBUG - About to enter for loop from i=0 to i=' + (steps.length - 1));
    let lastApiResponse = null;
    const getValueByPath = (obj, path, debugMode = false)=>{
      try {
        if (debugMode) {
          console.log(`🔍 [getValueByPath] Starting path resolution for: "${path}"`);
          console.log(`🔍 [getValueByPath] Input object keys:`, Object.keys(obj || {}));
        }
        // Strip 'extractedData.' prefix if present since extractedData is spread at contextData root
        let actualPath = path;
        if (path.startsWith('extractedData.')) {
          actualPath = path.substring('extractedData.'.length);
          if (debugMode) {
            console.log(`🔍 [getValueByPath] Stripped 'extractedData.' prefix. New path: "${actualPath}"`);
          }
        }
        const parts = actualPath.split('.');
        let current = obj;
        for(let i = 0; i < parts.length; i++){
          const part = parts[i];
          if (debugMode) {
            console.log(`🔍 [getValueByPath] Step ${i + 1}/${parts.length}: Processing part "${part}"`);
            console.log(`🔍 [getValueByPath] Current object type:`, typeof current);
            if (typeof current === 'object' && current !== null) {
              console.log(`🔍 [getValueByPath] Current object keys:`, Object.keys(current));
            }
          }
          if (part.includes('[') && part.includes(']')) {
            const arrayName = part.substring(0, part.indexOf('['));
            const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')));
            if (debugMode) {
              console.log(`🔍 [getValueByPath] Array access: ${arrayName}[${arrayIndex}]`);
              console.log(`🔍 [getValueByPath] Array exists:`, current?.[arrayName] !== undefined);
              console.log(`🔍 [getValueByPath] Array length:`, current?.[arrayName]?.length);
            }
            current = current[arrayName]?.[arrayIndex];
            if (debugMode) {
              console.log(`🔍 [getValueByPath] After array access, current:`, current);
            }
          } else if (!isNaN(Number(part))) {
            const arrayIndex = parseInt(part);
            if (debugMode) {
              console.log(`🔍 [getValueByPath] Numeric index access: [${arrayIndex}]`);
            }
            current = current?.[arrayIndex];
            if (debugMode) {
              console.log(`🔍 [getValueByPath] After numeric access, current:`, current);
            }
          } else {
            if (debugMode) {
              console.log(`🔍 [getValueByPath] Property access: .${part}`);
              console.log(`🔍 [getValueByPath] Property exists:`, current?.[part] !== undefined);
            }
            current = current?.[part];
            if (debugMode) {
              console.log(`🔍 [getValueByPath] After property access, current:`, current);
            }
          }
          if (current === undefined || current === null) {
            if (debugMode) {
              console.log(`🔍 [getValueByPath] Path resolution stopped at part "${part}" - value is ${current === undefined ? 'undefined' : 'null'}`);
            }
            return null;
          }
        }
        if (debugMode) {
          console.log(`🔍 [getValueByPath] ✅ Path resolution complete. Final value:`, current);
          console.log(`🔍 [getValueByPath] Final value type:`, typeof current);
        }
        return current;
      } catch (error) {
        console.error(`❌ [getValueByPath] Error getting value by path "${path}":`, error);
        return null;
      }
    };
    for(let i = 0; i < steps.length; i++){
      console.log(`\n🔄 DEBUG - Loop iteration i=${i}, processing step at index ${i}`);
      const step = steps[i];
      console.log(`🔄 DEBUG - Retrieved step object: order=${step.step_order}, name=${step.step_name}, type=${step.step_type}`);
      const stepStartTime = new Date().toISOString();
      const stepStartMs = Date.now();
      console.log(`🔄 === EXECUTING STEP ${step.step_order}: ${step.step_name} ===`);
      console.log('🔧 Step type:', step.step_type);
      console.log('🔧 Step ID:', step.id);

      let stepInputData = {
        config: step.config_json
      };

      try {
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
      } catch (updateError) {
        console.warn('⚠️ Failed to update workflow log:', updateError);
      }
      let stepOutputData = null;
      try {
        const config = step.config_json || {};
        let shouldSkipStep = false;
        let skipReason = '';
        if (config.skipIf) {
          console.log('🔍 Checking skipIf condition:', config.skipIf);
          const conditionResult = getValueByPath(contextData, config.skipIf);
          console.log('🔍 skipIf condition result:', conditionResult);
          if (conditionResult === true) {
            shouldSkipStep = true;
            skipReason = `skipIf condition met: ${config.skipIf} = true`;
            console.log(`⏭️ Skipping step ${step.step_order} (${step.step_name}): ${skipReason}`);
          }
        }
        if (!shouldSkipStep && config.runIf) {
          console.log('🔍 Checking runIf condition:', config.runIf);
          const conditionResult = getValueByPath(contextData, config.runIf);
          console.log('🔍 runIf condition result:', conditionResult);
          if (conditionResult !== true) {
            shouldSkipStep = true;
            skipReason = `runIf condition not met: ${config.runIf} = ${conditionResult}`;
            console.log(`⏭️ Skipping step ${step.step_order} (${step.step_name}): ${skipReason}`);
          }
        }
        if (shouldSkipStep) {
          stepOutputData = {
            skipped: true,
            reason: skipReason,
            conditionalSkip: true
          };
          const stepEndTime = new Date().toISOString();
          const stepDurationMs = Date.now() - stepStartMs;
          console.log(`⏭️ Step ${step.step_order} skipped due to conditional logic in ${stepDurationMs}ms`);
          if (workflowExecutionLogId) {
            await createStepLog(supabaseUrl, supabaseServiceKey, workflowExecutionLogId, requestData.workflowId, step, 'skipped', stepStartTime, stepEndTime, stepDurationMs, skipReason, stepInputData, stepOutputData);
          }
          console.log(`✅ DEBUG - Completed iteration i=${i} for step ${step.step_order}. Moving to next iteration.`);
          continue;
        }
        if (step.step_type === 'api_call') {
          console.log('🌐 === EXECUTING API CALL STEP ===');
          const config = step.config_json || {};
          console.log('🔧 API call config:', JSON.stringify(config, null, 2));
          let url = config.url || '';
          console.log('🔗 Original URL:', url);
          const urlPlaceholderRegex = /\{\{([^}]+)\}\}/g;
          let match;
          const replacements = [];
          while((match = urlPlaceholderRegex.exec(url)) !== null){
            const placeholder = match[0];
            const path = match[1];
            console.log(`🔍 Found URL placeholder: ${placeholder} with path: ${path}`);
            const value = getValueByPath(contextData, path);
            replacements.push({
              placeholder,
              path,
              value
            });
            console.log(`🔍 Path "${path}" resolved to:`, value);
          }
          for (const replacement of replacements){
            let rawValue = String(replacement.value || '');

            // Apply OData escaping if enabled (single quotes and consecutive parentheses)
            if (config.escapeSingleQuotesInBody && (rawValue.includes("'") || rawValue.includes(")("))) {
              const beforeEscape = rawValue;
              rawValue = escapeSingleQuotesForOData(rawValue);
              console.log(`🔄 Escaped for OData in URL: "${beforeEscape}" → "${rawValue}"`);
            }

            const encodedValue = encodeURIComponent(rawValue);
            const placeholderEscaped = replacement.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            url = url.replace(new RegExp(placeholderEscaped, 'g'), encodedValue);
            console.log(`🔄 Replaced ${replacement.placeholder} with: ${rawValue}`);
          }
          for (const [key, value] of Object.entries(contextData)){
            const placeholder = `{{${key}}}`;
            if (url.includes(placeholder) && !key.includes('.')) {
              const replacementValue = String(value || '');
              const encodedValue = replacementValue;
              url = url.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), encodedValue);
              console.log(`🔄 Replaced simple ${placeholder} with: ${replacementValue}`);
            }
          }
          console.log('🔗 Final URL:', url);
          // === DIAGNOSTIC START: Before Step 400 Execution ===
          try {
            if (step.step_order === 400 || step.step_name.includes('Send Updated JSON')) {
              console.log('DIAGNOSTIC: BEFORE STEP 400 EXECUTION');
              console.log('DIAGNOSTIC: Step Order:', step.step_order);
              console.log('DIAGNOSTIC: Step Name:', step.step_name);
              const clientIdFromOrders = getValueByPath(contextData, 'orders[0].consignee.clientId');
              const clientIdFromExtracted = getValueByPath(contextData, 'extractedData.orders[0].consignee.clientId');
              console.log('DIAGNOSTIC: contextData.orders[0]?.consignee?.clientId:', clientIdFromOrders);
              console.log('DIAGNOSTIC: contextData.extractedData?.orders?.[0]?.consignee?.clientId:', clientIdFromExtracted);
              if (contextData.extractedData && contextData.orders) {
                const refCheck = contextData.extractedData.orders === contextData.orders;
                console.log('DIAGNOSTIC: Reference Check:', refCheck ? 'SAME' : 'DIFFERENT');
              }
              const requestBodyTemplate = config.requestBody || '';
              console.log('DIAGNOSTIC: Request body contains {{extractedData}}:', requestBodyTemplate.includes('{{extractedData}}'));
            }
          } catch (e) {
            console.error('DIAGNOSTIC ERROR: Before Step 400', e);
          }
          // === DIAGNOSTIC END: Before Step 400 Execution ===
          let requestBody = config.requestBody || '';
          console.log('📄 Original request body template:', requestBody);
          const bodyPlaceholderRegex = /\{\{([^}]+)\}\}/g;
          let bodyMatch;
          const bodyReplacements = [];
          while((bodyMatch = bodyPlaceholderRegex.exec(requestBody)) !== null){
            const placeholder = bodyMatch[0];
            const path = bodyMatch[1];
            console.log(`🔍 Found request body placeholder: ${placeholder} with path: ${path}`);
            if (path === 'extractedData' || path === 'orders') {
              console.log(`⏭️ Skipping special placeholder: ${placeholder}`);
              continue;
            }
            const value = getValueByPath(contextData, path);
            bodyReplacements.push({
              placeholder,
              path,
              value
            });
            console.log(`🔍 Path "${path}" resolved to:`, value);
          }
          for (const replacement of bodyReplacements){
            let rawValue = String(replacement.value || '');
            // Apply OData escaping if enabled (single quotes and consecutive parentheses)
            if (config.escapeSingleQuotesInBody && (rawValue.includes("'") || rawValue.includes(")("))) {
              const beforeEscape = rawValue;
              rawValue = escapeSingleQuotesForOData(rawValue);
              console.log(`🔄 Escaped for OData: "${beforeEscape}" → "${rawValue}"`);
            }
            const escapedValue = rawValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
            requestBody = requestBody.replace(new RegExp(replacement.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), escapedValue);
            console.log(`🔄 Replaced ${replacement.placeholder} with: ${rawValue}`);
          }
          if (requestBody.includes('{{extractedData}}')) {
            console.log('🔧 Found {{extractedData}} placeholder - handling as JSON object');
            // === DIAGNOSTIC: Verify clientId before replacement ===
            console.log('🔍 PRE-REPLACEMENT DIAGNOSTIC:');
            if (contextData.extractedData && typeof contextData.extractedData === 'object') {
              const clientIdCheck = getValueByPath(contextData.extractedData, 'orders[0].consignee.clientId');
              console.log('  - contextData.extractedData.orders[0]?.consignee?.clientId:', clientIdCheck);
              console.log('  - extractedData type:', typeof contextData.extractedData);
              console.log('  - extractedData.orders exists:', !!contextData.extractedData.orders);
              if (contextData.extractedData.orders && Array.isArray(contextData.extractedData.orders)) {
                console.log('  - extractedData.orders length:', contextData.extractedData.orders.length);
                if (contextData.extractedData.orders[0]) {
                  console.log('  - extractedData.orders[0].consignee:', JSON.stringify(contextData.extractedData.orders[0].consignee));
                }
              }
            }
            if (contextData.extractedData && typeof contextData.extractedData === 'object') {
              const stringifiedData = JSON.stringify(contextData.extractedData);
              requestBody = requestBody.replace(/\{\{extractedData\}\}/g, stringifiedData);
              console.log('✅ Replaced {{extractedData}} with enriched extracted data object');
              console.log('🔍 Stringified data length:', stringifiedData.length);
              console.log('🔍 Stringified data contains "clientId":"10921":', stringifiedData.includes('"clientId":"10921"'));
              console.log('🔍 Stringified data preview (first 500 chars):', stringifiedData.substring(0, 500));
            } else if (contextData.originalExtractedData && typeof contextData.originalExtractedData === 'string') {
              requestBody = requestBody.replace(/\{\{extractedData\}\}/g, contextData.originalExtractedData);
              console.log('⚠️ Fallback: Replaced {{extractedData}} with original extracted data string');
            }
          }
          if (requestBody.includes('{{orders}}')) {
            console.log('🔧 Found {{orders}} placeholder - handling as JSON array');
            if (contextData.orders && Array.isArray(contextData.orders)) {
              requestBody = requestBody.replace(/\{\{orders\}\}/g, JSON.stringify(contextData.orders));
              console.log('✅ Replaced {{orders}} with stringified orders array');
            }
          }
          console.log('📄 Final request body:', requestBody);
          // === DIAGNOSTIC START: After Placeholder Replacement ===
          try {
            if (step.step_order === 400 || step.step_name.includes('Send Updated JSON')) {
              console.log('DIAGNOSTIC: AFTER PLACEHOLDER REPLACEMENT');
              console.log('DIAGNOSTIC: Request body (first 1000 chars):', requestBody.substring(0, 1000));
              try {
                const parsedBody = JSON.parse(requestBody);
                const clientIdInBody = parsedBody?.orders?.[0]?.consignee?.clientId;
                if (clientIdInBody) {
                  console.log('DIAGNOSTIC: SUCCESS - clientId in request body:', clientIdInBody);
                } else {
                  console.log('DIAGNOSTIC: FAILURE - clientId NOT in request body');
                  console.log('DIAGNOSTIC: parsedBody.orders?.[0]?.consignee:', parsedBody?.orders?.[0]?.consignee);
                }
              } catch (parseError) {
                console.log('DIAGNOSTIC: Could not parse request body as JSON (might be XML or other format)');
              }
            }
          } catch (e) {
            console.error('DIAGNOSTIC ERROR: After Placeholder Replacement', e);
          }
          // === DIAGNOSTIC END: After Placeholder Replacement ===
          console.log('🚀 Making API call...');
          const fetchOptions = {
            method: config.method || 'POST',
            headers: config.headers || {}
          };
          if (config.method && config.method.toUpperCase() !== 'GET' && requestBody && requestBody.trim() !== '') {
            fetchOptions.body = requestBody;
            console.log('📄 Including request body for', config.method, 'request');
          } else {
            console.log('🔍 GET request - no body included');
          }
          const apiResponse = await fetch(url, fetchOptions);
          console.log('📊 API response status:', apiResponse.status);
          console.log('📊 API response ok:', apiResponse.ok);
          if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('❌ API call failed:', errorText);
            throw new Error(`API call failed with status ${apiResponse.status}: ${errorText}`);
          }
          const responseText = await apiResponse.text();
          console.log('📏 API response length:', responseText.length);
          console.log('📄 API response preview:', responseText.substring(0, 200));
          if (!responseText || responseText.trim() === '') {
            console.error('❌ API returned empty response');
            throw new Error('API returned empty response body');
          }
          let responseData;
          try {
            responseData = JSON.parse(responseText);
            console.log('✅ API response parsed successfully');
            lastApiResponse = responseData;
            stepOutputData = responseData;
          } catch (responseParseError) {
            console.error('❌ Failed to parse API response:', responseParseError);
            console.error('📄 Problematic response:', responseText);
            throw new Error(`API response is not valid JSON: ${responseParseError.message}`);
          }
          // Support both old format (responseDataPath/updateJsonPath) and new format (responseDataMappings)
          let mappingsToProcess = []
          if (config.responseDataMappings && Array.isArray(config.responseDataMappings)) {
            mappingsToProcess = config.responseDataMappings
            console.log('📋 Using new format: processing', mappingsToProcess.length, 'mapping(s)')
          } else if (config.responseDataPath && config.updateJsonPath) {
            mappingsToProcess = [{
              responsePath: config.responseDataPath,
              updatePath: config.updateJsonPath
            }]
            console.log('📋 Using old format: converted to single mapping')
          }
          if (mappingsToProcess.length > 0) {
            console.log('🔄 === EXTRACTING DATA FROM API RESPONSE ===');
            console.log('🔍 DEBUG - Full API responseData:', JSON.stringify(responseData, null, 2).substring(0, 2000));
            for (const mapping of mappingsToProcess) {
              const responsePath = mapping.responsePath;
              const updatePath = mapping.updatePath || mapping.fieldName;
              if (!responsePath || !updatePath) {
                console.warn('⚠️ Skipping invalid mapping:', mapping);
                continue;
              }
              console.log('🔍 === PROCESSING MAPPING ===');
              console.log('🔍 DEBUG - responsePath:', responsePath);
              console.log('🔍 DEBUG - updatePath:', updatePath);
              console.log('🔍 DEBUG - contextData BEFORE update:', JSON.stringify(contextData, null, 2).substring(0, 1000));
              console.log('🔍 === STEP 1: EXTRACTING VALUE FROM API RESPONSE ===');
              const extractedValue = getValueByPath(responseData, responsePath, true);
              if (extractedValue !== undefined && extractedValue !== null) {
                console.log(`✅ Extracted value: ${JSON.stringify(extractedValue)}`);
                console.log(`🔄 Updating contextData.${updatePath} with extracted value`);
                // Support nested paths like "billNumber" or "metadata.billNumber"
                const pathParts = updatePath.split('.');
                let current = contextData;
                for (let i = 0; i < pathParts.length - 1; i++) {
                  const part = pathParts[i];
                  if (!current[part]) {
                    current[part] = {};
                  }
                  current = current[part];
                }
                current[pathParts[pathParts.length - 1]] = extractedValue;
                console.log(`✅ Updated contextData.${updatePath} = ${JSON.stringify(extractedValue)}`);
              } else {
                console.warn(`⚠️ Path "${responsePath}" not found in API response`);
              }
            }
          } else {
            console.log('ℹ️ No response data mappings configured for this API call');
          }
          // === DIAGNOSTIC START: After API Response Update ===
          try {
            if (step.step_order === 100 || step.step_name.includes('POST TruckMate')) {
              console.log('DIAGNOSTIC: AFTER API RESPONSE UPDATE');
              console.log('DIAGNOSTIC: Step Order:', step.step_order);
              console.log('DIAGNOSTIC: Step Name:', step.step_name);
              console.log('DIAGNOSTIC: contextData.billNumber:', contextData.billNumber);
              console.log('DIAGNOSTIC: contextData.orderID:', contextData.orderID);
              const clientIdFromOrders = getValueByPath(contextData, 'orders[0].consignee.clientId');
              const clientIdFromExtracted = getValueByPath(contextData, 'extractedData.orders[0].consignee.clientId');
              console.log('DIAGNOSTIC: contextData.orders[0]?.consignee?.clientId:', clientIdFromOrders);
              console.log('DIAGNOSTIC: contextData.extractedData?.orders?.[0]?.consignee?.clientId:', clientIdFromExtracted);
              if (contextData.extractedData && contextData.orders) {
                const refCheck = contextData.extractedData.orders === contextData.orders;
                console.log('DIAGNOSTIC: Reference Check:', refCheck ? 'SAME' : 'DIFFERENT');
              }
            }
          } catch (e) {
            console.error('DIAGNOSTIC ERROR: After API Response Update', e);
          }
          // === DIAGNOSTIC END: After API Response Update ===
        } else if (step.step_type === 'api_endpoint') {
          console.log('🌐 === EXECUTING API ENDPOINT STEP ===');
          const config = step.config_json || {};
          console.log('🔧 API endpoint config:', JSON.stringify(config, null, 2));
          let baseUrl = '';
          let authToken = '';
          let mainApiConfig = null;
          const apiSourceType = config.apiSourceType || 'main';
          console.log('📋 API Source Type:', apiSourceType);
          if (apiSourceType === 'main') {
            try {
              console.log('🔍 Fetching main API config from api_settings table...');
              const mainApiResponse = await fetch(`${supabaseUrl}/rest/v1/api_settings?select=*`, {
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                  'apikey': supabaseServiceKey
                }
              });
              console.log('📊 Main API config response status:', mainApiResponse.status);
              console.log('📊 Main API config response ok:', mainApiResponse.ok);
              if (mainApiResponse.ok) {
                const mainApiResponseText = await mainApiResponse.text();
                console.log('📊 Main API config response text length:', mainApiResponseText.length);
                console.log('📊 Main API config response text:', mainApiResponseText);
                const mainApis = JSON.parse(mainApiResponseText);
                console.log('📊 Main API configs array length:', mainApis.length);
                if (mainApis && mainApis.length > 0) {
                  mainApiConfig = mainApis[0];
                  console.log('📊 First main API config raw object:', JSON.stringify(mainApiConfig, null, 2));
                  console.log('📊 Main API config path field value:', mainApiConfig.path);
                  console.log('📊 Main API config path type:', typeof mainApiConfig.path);
                  console.log('📊 Main API config path is empty?', !mainApiConfig.path);
                  baseUrl = mainApiConfig.path || '';
                  authToken = mainApiConfig.password || '';
                  console.log('✅ Loaded main API config');
                  console.log('🔗 Base URL assigned:', baseUrl ? baseUrl : 'EMPTY');
                  console.log('🔑 Auth token loaded:', authToken ? `${authToken.substring(0, 10)}...` : 'EMPTY');
                } else {
                  console.warn('⚠️ No main API configs found in database (array is empty)');
                }
              } else {
                const errorText = await mainApiResponse.text();
                console.error('❌ Main API config fetch failed with status:', mainApiResponse.status);
                console.error('❌ Error response:', errorText);
              }
            } catch (apiConfigError) {
              console.error('❌ Failed to load main API config:', apiConfigError);
              console.error('❌ Error type:', apiConfigError.constructor.name);
              console.error('❌ Error message:', apiConfigError.message);
            }
          } else if (apiSourceType === 'secondary' && config.secondaryApiId) {
            try {
              console.log('🔍 Fetching secondary API config from secondary_api_configs table...');
              console.log('🔍 Secondary API ID:', config.secondaryApiId);
              const secondaryApiResponse = await fetch(`${supabaseUrl}/rest/v1/secondary_api_configs?select=*&id=eq.${config.secondaryApiId}`, {
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                  'apikey': supabaseServiceKey
                }
              });
              console.log('📊 Secondary API config response status:', secondaryApiResponse.status);
              console.log('📊 Secondary API config response ok:', secondaryApiResponse.ok);
              if (secondaryApiResponse.ok) {
                const secondaryApiResponseText = await secondaryApiResponse.text();
                console.log('📊 Secondary API config response text length:', secondaryApiResponseText.length);
                console.log('📊 Secondary API config response text:', secondaryApiResponseText);
                const secondaryApis = JSON.parse(secondaryApiResponseText);
                console.log('📊 Secondary API configs array length:', secondaryApis.length);
                if (secondaryApis && secondaryApis.length > 0) {
                  const secondaryApiConfig = secondaryApis[0];
                  console.log('📊 First secondary API config raw object:', JSON.stringify(secondaryApiConfig, null, 2));
                  console.log('📊 Secondary API config base_url field value:', secondaryApiConfig.base_url);
                  console.log('📊 Secondary API config base_url type:', typeof secondaryApiConfig.base_url);
                  console.log('📊 Secondary API config base_url is empty?', !secondaryApiConfig.base_url);
                  baseUrl = secondaryApiConfig.base_url || '';
                  authToken = secondaryApiConfig.auth_token || '';
                  console.log('✅ Loaded secondary API config:', secondaryApiConfig.name);
                  console.log('🔗 Base URL assigned:', baseUrl ? baseUrl : 'EMPTY');
                  console.log('🔑 Auth token loaded:', authToken ? `${authToken.substring(0, 10)}...` : 'EMPTY');
                } else {
                  console.warn('⚠️ No secondary API configs found in database for ID:', config.secondaryApiId);
                }
              } else {
                const errorText = await secondaryApiResponse.text();
                console.error('❌ Secondary API config fetch failed with status:', secondaryApiResponse.status);
                console.error('❌ Error response:', errorText);
              }
            } catch (apiConfigError) {
              console.error('❌ Failed to load secondary API config:', apiConfigError);
              console.error('❌ Error type:', apiConfigError.constructor.name);
              console.error('❌ Error message:', apiConfigError.message);
            }
          }

          console.log('🔍 === API CONFIG VALIDATION ===');
          console.log('🔍 Final baseUrl value:', baseUrl);
          console.log('🔍 Final baseUrl length:', baseUrl.length);
          console.log('🔍 Final baseUrl is empty:', !baseUrl || baseUrl.trim() === '');
          console.log('🔍 Final authToken present:', !!authToken);

          if (!baseUrl || baseUrl.trim() === '') {
            const errorMsg = `❌ CRITICAL ERROR: Base URL is empty after loading ${apiSourceType} API config.\n` +
              `   API Source Type: ${apiSourceType}\n` +
              `   ${apiSourceType === 'secondary' ? `Secondary API ID: ${config.secondaryApiId}\n` : ''}` +
              `   This indicates the API configuration is missing or incomplete in the database.\n` +
              `   Please check the following:\n` +
              `   1. For main API: Verify that the api_settings table has a row with a valid path\n` +
              `   2. For secondary API: Verify that secondary_api_configs table has a row with id=${config.secondaryApiId} and a valid base_url\n` +
              `   3. Ensure the path field (main API) or base_url field (secondary API) is not NULL or empty string in the database\n` +
              `   4. Check the database migration and RLS policies allow reading these tables`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }

          console.log('✅ Base URL validation passed:', baseUrl);
          // Build URL with path and query parameters
          let apiPath = config.apiPath || '';
          const httpMethod = config.httpMethod || 'GET';

          // Replace path variables using pathVariableConfig
          // Supports both simple string format: { "orderId": "{{orderID}}" }
          // And complex object format: { "orderId": { "enabled": true, "value": "{{orderID}}" } }
          const pathVariableConfig = config.pathVariableConfig || {};
          console.log('🔧 Path variable config:', JSON.stringify(pathVariableConfig));

          for (const [varName, varConfig] of Object.entries(pathVariableConfig)) {
            // Detect format: string (simple) or object (complex)
            const isSimpleFormat = typeof varConfig === 'string';
            const isEnabled = isSimpleFormat ? true : (varConfig.enabled ?? true);
            const valueTemplate = isSimpleFormat ? varConfig : (varConfig.value || '');

            console.log(`🔍 Processing path variable: ${varName} (format: ${isSimpleFormat ? 'simple string' : 'object'})`);

            if (isEnabled && valueTemplate) {
              console.log(`  - Value template: ${valueTemplate}`);

              let resolvedValue = valueTemplate;

              // Replace variables in the configured value using replaceAll approach
              const valueVarRegex = /\{\{([^}]+)\}\}|\$\{([^}]+)\}/g;
              resolvedValue = valueTemplate.replace(valueVarRegex, (match, doubleBrace, dollarBrace) => {
                const variableName = doubleBrace || dollarBrace;
                const value = getValueByPath(contextData, variableName);
                if (value !== undefined && value !== null) {
                  console.log(`  - Resolved ${match} to: ${value}`);
                  return String(value);
                }
                console.warn(`  - ⚠️ Variable ${match} not found in context, leaving unchanged`);
                return match;
              });

              console.log(`  - Final resolved value: ${resolvedValue}`);

              // Replace the path variable in apiPath (supports both {varName} and ${varName} formats)
              const pathVarPattern1 = `{${varName}}`;
              const pathVarPattern2 = `\${${varName}}`;

              if (apiPath.includes(pathVarPattern1)) {
                apiPath = apiPath.replace(pathVarPattern1, resolvedValue);
                console.log(`  - ✅ Replaced ${pathVarPattern1} in path`);
              } else if (apiPath.includes(pathVarPattern2)) {
                apiPath = apiPath.replace(pathVarPattern2, resolvedValue);
                console.log(`  - ✅ Replaced ${pathVarPattern2} in path`);
              } else {
                console.log(`  - ⚠️ Path variable {${varName}} not found in apiPath`);
              }
            } else {
              console.log(`⏭️ Skipping disabled or empty path variable: ${varName}`);
            }
          }

          console.log('🔗 API path after path variable replacement:', apiPath);

          // Build query string from enabled parameters
          const queryParameterConfig = config.queryParameterConfig || {};
          const odataParams = ['$filter', '$select', '$orderby', '$orderBy', '$expand', '$top', '$skip', '$count', '$search'];
          const regularParams: string[] = [];
          const odataParamParts: string[] = [];

          for (const [paramName, paramConfig] of Object.entries(queryParameterConfig)) {
            if (paramConfig.enabled && paramConfig.value) {
              let paramValue = paramConfig.value;

              // Replace variables in parameter values using replaceAll approach
              const valueVarRegex = /\{\{([^}]+)\}\}|\$\{([^}]+)\}/g;
              paramValue = paramConfig.value.replace(valueVarRegex, (match, doubleBrace, dollarBrace) => {
                const variableName = doubleBrace || dollarBrace;
                const value = getValueByPath(contextData, variableName);
                if (value !== undefined && value !== null) {
                  let rawValue = String(value);
                  const isODataFilterParam = paramName.toLowerCase() === '$filter';
                  if (isODataFilterParam && rawValue.includes(')(')) {
                    rawValue = rawValue.replace(/\)\(/g, ')-(');
                    console.log(`🔧 Escaped )( to )-( in $filter param value:`, rawValue);
                  }
                  console.log(`🔄 Replaced query param variable ${match} with:`, rawValue);
                  return rawValue;
                }
                console.warn(`⚠️ Variable ${match} not found in context, leaving unchanged`);
                return match;
              });
              console.log(`📋 Final param value for "${paramName}":`, paramValue);

              const isODataParam = odataParams.some(p => p.toLowerCase() === paramName.toLowerCase());
              if (isODataParam) {
                const encodedValue = paramValue.replace(/ /g, '%20');
                odataParamParts.push(`${paramName}=${encodedValue}`);
                console.log(`📋 OData param "${paramName}" using minimal encoding:`, encodedValue);
              } else {
                regularParams.push(`${encodeURIComponent(paramName)}=${encodeURIComponent(paramValue)}`);
              }
            }
          }

          const allParams = [...regularParams, ...odataParamParts];
          const queryString = allParams.join('&');
          const fullUrl = `${baseUrl}${apiPath}${queryString ? '?' + queryString : ''}`;
          console.log('🔗 Full API Endpoint URL:', fullUrl);
          console.log('📤 Making', httpMethod, 'request to API endpoint');
          console.log('  - Method:', httpMethod);
          console.log('📋 Request Details:');
          console.log('  - URL:', fullUrl);
          console.log('  - API Path:', apiPath);
          console.log('  - Query String:', queryString);
          console.log('  - Base URL:', baseUrl);
          const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          };
          console.log('  - Headers:', JSON.stringify(headers));

          stepInputData = {
            ...stepInputData,
            stepType: 'api_endpoint',
            apiSourceType: apiSourceType,
            baseUrl: baseUrl,
            apiPath: apiPath,
            queryString: queryString,
            fullUrl: fullUrl,
            httpMethod: httpMethod,
            authTokenPresent: !!authToken,
            authTokenPreview: authToken ? `${authToken.substring(0, 10)}...` : 'NONE',
            secondaryApiId: config.secondaryApiId || null
          };
          console.log('📊 Step input data captured for logging:', JSON.stringify(stepInputData, null, 2));
          let requestBodyContent = config.requestBodyTemplate || '';
          console.log('📄 Request body template:', requestBodyContent);
          const requestBodyFieldMappings = config.requestBodyFieldMappings || [];
          if (requestBodyFieldMappings.length > 0 && requestBodyContent) {
            console.log('🔧 Processing', requestBodyFieldMappings.length, 'field mappings');
            try {
              let requestBodyData = JSON.parse(requestBodyContent);
              for (const mapping of requestBodyFieldMappings) {
                const fieldPath = mapping.fieldName;
                const mappingType = mapping.type;
                const mappingValue = mapping.value;
                const dataType = mapping.dataType || 'string';
                console.log(`🔧 Processing field: ${fieldPath} (type: ${mappingType}, dataType: ${dataType})`);
                let finalValue;
                if (mappingType === 'hardcoded') {
                  finalValue = mappingValue;
                  console.log(`  - Using hardcoded value: ${finalValue}`);
                } else if (mappingType === 'variable') {
                  const variableName = mappingValue.replace(/^\{\{|\}\}$/g, '');
                  finalValue = getValueByPath(contextData, variableName);
                  console.log(`  - Resolved variable ${mappingValue} to: ${finalValue}`);
                } else {
                  console.warn(`  - Unknown mapping type: ${mappingType}`);
                  continue;
                }
                if (finalValue !== undefined && finalValue !== null) {
                  if (dataType === 'integer') {
                    finalValue = parseInt(String(finalValue));
                  } else if (dataType === 'number') {
                    finalValue = parseFloat(String(finalValue));
                  } else if (dataType === 'boolean') {
                    finalValue = String(finalValue).toLowerCase() === 'true';
                  } else {
                    finalValue = String(finalValue);
                  }
                  console.log(`  - Final typed value (${dataType}): ${finalValue}`);
                  const pathParts = fieldPath.split('.');
                  let current = requestBodyData;
                  for (let i = 0; i < pathParts.length - 1; i++) {
                    const part = pathParts[i];
                    const match = part.match(/^(\w+)\[(\d+)\]$/);
                    if (match) {
                      const arrayName = match[1];
                      const arrayIndex = parseInt(match[2]);
                      if (!current[arrayName]) {
                        current[arrayName] = [];
                      }
                      while (current[arrayName].length <= arrayIndex) {
                        current[arrayName].push({});
                      }
                      current = current[arrayName][arrayIndex];
                    } else {
                      if (!current[part]) {
                        current[part] = {};
                      }
                      current = current[part];
                    }
                  }
                  const lastPart = pathParts[pathParts.length - 1];
                  const match = lastPart.match(/^(\w+)\[(\d+)\]$/);
                  if (match) {
                    const arrayName = match[1];
                    const arrayIndex = parseInt(match[2]);
                    if (!current[arrayName]) {
                      current[arrayName] = [];
                    }
                    while (current[arrayName].length <= arrayIndex) {
                      current[arrayName].push({});
                    }
                    current[arrayName][arrayIndex] = finalValue;
                  } else {
                    current[lastPart] = finalValue;
                  }
                  console.log(`  - ✅ Set ${fieldPath} = ${finalValue}`);
                } else {
                  console.warn(`  - ⚠️ Could not resolve value for ${fieldPath}`);
                }
              }
              requestBodyContent = JSON.stringify(requestBodyData);
              console.log('✅ Request body after field mappings:', requestBodyContent);
            } catch (mappingError) {
              console.error('❌ Error processing field mappings:', mappingError);
              console.log('⚠️ Using original request body template');
            }
          }
          const fetchOptions = {
            method: httpMethod,
            headers
          };
          if (httpMethod.toUpperCase() !== 'GET' && requestBodyContent && requestBodyContent.trim() !== '') {
            fetchOptions.body = requestBodyContent;
            console.log('📄 Request body:', requestBodyContent);
          }
          const apiEndpointResponse = await fetch(fullUrl, fetchOptions);
          console.log('📥 API endpoint response status:', apiEndpointResponse.status);
          if (!apiEndpointResponse.ok) {
            const errorText = await apiEndpointResponse.text();
            console.error('❌ API endpoint call failed:', errorText);
            throw new Error(`API endpoint call failed with status ${apiEndpointResponse.status}: ${errorText}`);
          }
          const apiEndpointResponseText = await apiEndpointResponse.text();
          console.log('📏 API endpoint response length:', apiEndpointResponseText.length);
          let apiEndpointResponseData = null;
          try {
            if (apiEndpointResponseText && apiEndpointResponseText.trim() !== '') {
              apiEndpointResponseData = JSON.parse(apiEndpointResponseText);
              console.log('✅ API endpoint response parsed successfully');
              stepOutputData = apiEndpointResponseData;
            } else {
              console.log('ℹ️ API endpoint returned empty response (might be successful with no body)');
              stepOutputData = { success: true, emptyResponse: true };
            }
          } catch (responseParseError) {
            console.warn('⚠️ Could not parse API endpoint response as JSON:', responseParseError);
            console.log('📄 Raw response:', apiEndpointResponseText);
            stepOutputData = { rawResponse: apiEndpointResponseText };
          }
          const responseDataMappings = config.responseDataMappings || [];
          if (responseDataMappings.length > 0 && apiEndpointResponseData) {
            console.log('🔄 === EXTRACTING DATA FROM API RESPONSE ===');
            for (const mapping of responseDataMappings) {
              const responsePath = mapping.responsePath;
              const updatePath = mapping.updatePath || mapping.fieldName;
              if (!responsePath || !updatePath) {
                console.warn('⚠️ Skipping invalid mapping:', mapping);
                continue;
              }
              console.log(`🔍 Extracting from response path: ${responsePath}`);
              const extractedValue = getValueByPath(apiEndpointResponseData, responsePath);
              if (extractedValue !== undefined && extractedValue !== null) {
                console.log(`✅ Extracted value: ${JSON.stringify(extractedValue)}`);
                console.log(`🔄 Updating contextData.${updatePath}`);
                const pathParts = updatePath.split(/[.\[\]]/).filter(Boolean);
                let current = contextData;
                for (let i = 0; i < pathParts.length - 1; i++) {
                  const part = pathParts[i];
                  const nextPart = pathParts[i + 1];
                  const isNextPartArrayIndex = /^\d+$/.test(nextPart);
                  if (current[part] === undefined || current[part] === null) {
                    current[part] = isNextPartArrayIndex ? [] : {};
                  }
                  current = current[part];
                }
                const lastPart = pathParts[pathParts.length - 1];
                current[lastPart] = extractedValue;
                console.log(`✅ Updated contextData.${updatePath} = ${JSON.stringify(extractedValue)}`);
              } else {
                console.warn(`⚠️ Path "${responsePath}" not found in API response`);
              }
            }
          }
        } else if (step.step_type === 'csv_upload') {
          console.log('📤 === EXECUTING CSV UPLOAD STEP ===');
          const config = step.config_json || {};
          console.log('🔧 CSV upload config:', JSON.stringify(config, null, 2));
          let csvData = contextData.extractedData;
          if (typeof csvData !== 'string') {
            console.error('❌ CSV data is not a string');
            throw new Error('CSV upload step requires string data, but got object');
          }
          if (!csvData || csvData.trim() === '') {
            console.error('❌ CSV data is empty');
            throw new Error('CSV data is empty');
          }
          console.log('📊 CSV data length:', csvData.length);
          const uploadMode = config.uploadMode || 'sftp';
          console.log('📤 Upload mode:', uploadMode);
          if (uploadMode === 'sftp') {
            console.log('📤 Uploading via SFTP...');
            let sftpConfig;
            try {
              const sftpConfigResponse = await fetch(`${supabaseUrl}/rest/v1/sftp_config?select=*`, {
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                  'apikey': supabaseServiceKey
                }
              });
              if (sftpConfigResponse.ok) {
                const sftpConfigs = await sftpConfigResponse.json();
                if (sftpConfigs && sftpConfigs.length > 0) {
                  sftpConfig = sftpConfigs[0];
                  console.log('✅ SFTP config loaded');
                }
              }
            } catch (sftpConfigError) {
              console.error('❌ Failed to load SFTP config:', sftpConfigError);
              throw new Error('SFTP config not found');
            }
            if (!sftpConfig) {
              throw new Error('SFTP config not found');
            }
            const filename = contextData.pdfFilename || requestData.pdfFilename || 'output.csv';
            const csvFilename = filename.replace(/\.pdf$/i, '.csv');
            console.log('📄 Upload filename:', csvFilename);
            const sftpUploadPayload = {
              host: sftpConfig.host,
              port: sftpConfig.port || 22,
              username: sftpConfig.username,
              password: sftpConfig.password,
              remotePath: `${sftpConfig.remote_path}/${csvFilename}`,
              fileContent: csvData,
              encoding: 'utf8'
            };
            console.log('📤 Calling SFTP upload edge function...');
            console.log('📤 Remote path:', sftpUploadPayload.remotePath);
            const sftpUploadResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(sftpUploadPayload)
            });
            if (!sftpUploadResponse.ok) {
              const errorText = await sftpUploadResponse.text();
              console.error('❌ SFTP upload failed:', errorText);
              throw new Error(`SFTP upload failed: ${errorText}`);
            }
            const sftpUploadResult = await sftpUploadResponse.json();
            console.log('✅ SFTP upload successful:', sftpUploadResult);
            stepOutputData = {
              uploadMode: 'sftp',
              filename: csvFilename,
              remotePath: sftpUploadPayload.remotePath,
              success: true
            };
          } else {
            throw new Error(`Unsupported upload mode: ${uploadMode}`);
          }
        } else if (step.step_type === 'json_transform') {
          console.log('🔧 === EXECUTING JSON TRANSFORM STEP ===');
          const config = step.config_json || {};
          console.log('🔧 Transform config:', JSON.stringify(config, null, 2));
          if (config.outputFields && Array.isArray(config.outputFields)) {
            console.log('📊 Filtering JSON to include only output fields...');
            const filteredData = filterJsonWorkflowOnlyFields(contextData.extractedData, config.outputFields);
            contextData.extractedData = filteredData;
            console.log('✅ JSON transform applied successfully');
            stepOutputData = { transformed: true, fieldCount: config.outputFields.filter((f)=>!f.isWorkflowOnly).length };
          } else {
            console.log('ℹ️ No output fields configured, skipping transform');
            stepOutputData = { transformed: false, reason: 'no output fields configured' };
          }
        } else if (step.step_type === 'json_upload') {
          console.log('📤 === EXECUTING JSON UPLOAD STEP ===');
          const config = step.config_json || {};
          console.log('🔧 JSON upload config:', JSON.stringify(config, null, 2));
          let jsonData = contextData.extractedData;
          if (typeof jsonData === 'string') {
            try {
              jsonData = JSON.parse(jsonData);
            } catch (parseError) {
              console.error('❌ Failed to parse JSON data:', parseError);
              throw new Error('JSON upload step requires valid JSON data');
            }
          }
          if (!jsonData || (typeof jsonData === 'object' && Object.keys(jsonData).length === 0)) {
            console.error('❌ JSON data is empty');
            throw new Error('JSON data is empty');
          }
          console.log('📊 JSON data keys:', Object.keys(jsonData));
          const uploadMode = config.uploadMode || 'sftp';
          console.log('📤 Upload mode:', uploadMode);
          if (uploadMode === 'sftp') {
            console.log('📤 Uploading via SFTP...');
            let sftpConfig;
            try {
              const sftpConfigResponse = await fetch(`${supabaseUrl}/rest/v1/sftp_config?select=*`, {
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'Content-Type': 'application/json',
                  'apikey': supabaseServiceKey
                }
              });
              if (sftpConfigResponse.ok) {
                const sftpConfigs = await sftpConfigResponse.json();
                if (sftpConfigs && sftpConfigs.length > 0) {
                  sftpConfig = sftpConfigs[0];
                  console.log('✅ SFTP config loaded');
                }
              }
            } catch (sftpConfigError) {
              console.error('❌ Failed to load SFTP config:', sftpConfigError);
              throw new Error('SFTP config not found');
            }
            if (!sftpConfig) {
              throw new Error('SFTP config not found');
            }
            const filename = contextData.pdfFilename || requestData.pdfFilename || 'output.json';
            const jsonFilename = filename.replace(/\.pdf$/i, '.json');
            console.log('📄 Upload filename:', jsonFilename);
            const jsonString = JSON.stringify(jsonData, null, 2);
            const sftpUploadPayload = {
              host: sftpConfig.host,
              port: sftpConfig.port || 22,
              username: sftpConfig.username,
              password: sftpConfig.password,
              remotePath: `${sftpConfig.remote_path}/${jsonFilename}`,
              fileContent: jsonString,
              encoding: 'utf8'
            };
            console.log('📤 Calling SFTP upload edge function...');
            console.log('📤 Remote path:', sftpUploadPayload.remotePath);
            const sftpUploadResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(sftpUploadPayload)
            });
            if (!sftpUploadResponse.ok) {
              const errorText = await sftpUploadResponse.text();
              console.error('❌ SFTP upload failed:', errorText);
              throw new Error(`SFTP upload failed: ${errorText}`);
            }
            const sftpUploadResult = await sftpUploadResponse.json();
            console.log('✅ SFTP upload successful:', sftpUploadResult);
            stepOutputData = {
              uploadMode: 'sftp',
              filename: jsonFilename,
              remotePath: sftpUploadPayload.remotePath,
              success: true
            };
          } else {
            throw new Error(`Unsupported upload mode: ${uploadMode}`);
          }
        } else if (step.step_type === 'sftp_upload') {
          console.log('📤 === EXECUTING SFTP UPLOAD STEP ===');
          const config = step.config_json || {};
          console.log('🔧 SFTP upload config:', JSON.stringify(config, null, 2));

          console.log('📋 Fetching default SFTP configuration...');
          const sftpConfigResponse = await fetch(`${supabaseUrl}/rest/v1/sftp_config?limit=1`, {
            headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey }
          });

          if (!sftpConfigResponse.ok) {
            throw new Error(`Failed to fetch SFTP configuration: ${sftpConfigResponse.status} ${sftpConfigResponse.statusText}`);
          }

          const sftpConfigs = await sftpConfigResponse.json();
          if (!sftpConfigs || sftpConfigs.length === 0) {
            throw new Error('No SFTP configuration found. Please configure SFTP settings in Settings.');
          }

          const sftpConfig = sftpConfigs[0];
          console.log('✅ SFTP configuration loaded:', sftpConfig.name || sftpConfig.host);

          let fileContent = '';
          let filename = contextData.renamedFilename || contextData.actualFilename || contextData.pdfFilename || 'document';

          if (config.uploadType === 'pdf') {
            console.log('📄 Uploading PDF file');

            if (contextData.renamedPdfFilename) {
              filename = contextData.renamedPdfFilename;
              console.log('✅ Using renamed PDF filename:', filename);
            } else if (!filename.toLowerCase().endsWith('.pdf')) {
              filename = `${filename}.pdf`;
            }

            if (!contextData.pdfBase64) {
              throw new Error('PDF base64 data not available');
            }

            fileContent = contextData.pdfBase64;

          } else if (config.uploadType === 'json') {
            console.log('📄 Uploading JSON file');

            if (contextData.renamedJsonFilename) {
              filename = contextData.renamedJsonFilename;
              console.log('✅ Using renamed JSON filename:', filename);
            } else if (!filename.toLowerCase().endsWith('.json')) {
              filename = filename.replace(/\.(pdf|json|xml|csv)$/i, '') + '.json';
            }

            const dataToUpload = contextData.extractedData || contextData;
            fileContent = Buffer.from(JSON.stringify(dataToUpload, null, 2)).toString('base64');

          } else if (config.uploadType === 'xml') {
            console.log('📄 Uploading XML file');

            if (contextData.renamedXmlFilename) {
              filename = contextData.renamedXmlFilename;
              console.log('✅ Using renamed XML filename:', filename);
            } else if (!filename.toLowerCase().endsWith('.xml')) {
              filename = filename.replace(/\.(pdf|json|xml|csv)$/i, '') + '.xml';
            }

            const dataToUpload = contextData.extractedData || contextData;
            fileContent = Buffer.from(JSON.stringify(dataToUpload, null, 2)).toString('base64');

          } else if (config.uploadType === 'csv') {
            console.log('📄 === UPLOADING CSV FILE ===');

            if (contextData.renamedCsvFilename) {
              filename = contextData.renamedCsvFilename;
              console.log('✅ Using renamed CSV filename:', filename);
            } else if (!filename.toLowerCase().endsWith('.csv')) {
              filename = filename.replace(/\.(pdf|json|xml|csv)$/i, '') + '.csv';
            }

            console.log('📊 Searching for CSV data in contextData...');
            console.log('📊 contextData.extractedData type:', typeof contextData.extractedData);
            console.log('📊 contextData.originalExtractedData type:', typeof contextData.originalExtractedData);

            let csvData = null;

            if (contextData.extractedData && typeof contextData.extractedData === 'string') {
              console.log('✅ Found CSV data in extractedData (string)');
              csvData = contextData.extractedData;
              console.log('📊 CSV data length:', csvData.length);
              console.log('📊 CSV data preview (first 200 chars):', csvData.substring(0, 200));
              console.log('📊 CSV data preview (last 100 chars):', csvData.substring(Math.max(0, csvData.length - 100)));
            } else if (contextData.originalExtractedData && typeof contextData.originalExtractedData === 'string') {
              console.log('✅ Found CSV data in originalExtractedData (string)');
              csvData = contextData.originalExtractedData;
              console.log('📊 CSV data length:', csvData.length);
              console.log('📊 CSV data preview (first 200 chars):', csvData.substring(0, 200));
              console.log('📊 CSV data preview (last 100 chars):', csvData.substring(Math.max(0, csvData.length - 100)));
            } else {
              console.error('❌ CSV data not found');
              console.error('- extractedData type:', typeof contextData.extractedData);
              console.error('- originalExtractedData type:', typeof contextData.originalExtractedData);
              console.error('- extractedData value:', contextData.extractedData);
              console.error('- originalExtractedData value:', contextData.originalExtractedData);
              throw new Error('CSV data not available or not in string format');
            }

            fileContent = csvData;
            console.log('✅ CSV data prepared for upload, length:', fileContent.length);
            console.log('✅ CSV fileContent preview (first 200 chars):', fileContent.substring(0, 200));
          }

          console.log('📤 Calling SFTP upload function...');
          console.log('📄 Filename:', filename);
          console.log('📏 File content length:', fileContent.length);

          const uploadFileTypes = {};
          if (config.uploadType === 'pdf') {
            uploadFileTypes.pdf = true;
          } else if (config.uploadType === 'json') {
            uploadFileTypes.json = true;
          } else if (config.uploadType === 'xml') {
            uploadFileTypes.xml = true;
          } else if (config.uploadType === 'csv') {
            uploadFileTypes.csv = true;
          }

          let exactFilenameToPass = undefined;

          if (config.uploadType === 'pdf' && contextData.renamedPdfFilename) {
            exactFilenameToPass = contextData.renamedPdfFilename.replace(/\.(pdf|csv|json|xml)$/i, '');
            console.log('📤 Passing exact filename for PDF:', exactFilenameToPass);
          } else if (config.uploadType === 'csv' && contextData.renamedCsvFilename) {
            exactFilenameToPass = contextData.renamedCsvFilename.replace(/\.(pdf|csv|json|xml)$/i, '');
            console.log('📤 Passing exact filename for CSV:', exactFilenameToPass);
          } else if (config.uploadType === 'json' && contextData.renamedJsonFilename) {
            exactFilenameToPass = contextData.renamedJsonFilename.replace(/\.(pdf|csv|json|xml)$/i, '');
            console.log('📤 Passing exact filename for JSON:', exactFilenameToPass);
          } else if (config.uploadType === 'xml' && contextData.renamedXmlFilename) {
            exactFilenameToPass = contextData.renamedXmlFilename.replace(/\.(pdf|csv|json|xml)$/i, '');
            console.log('📤 Passing exact filename for XML:', exactFilenameToPass);
          } else if (contextData.renamedFilename) {
            exactFilenameToPass = contextData.renamedFilename.replace(/\.(pdf|csv|json|xml)$/i, '');
            console.log('📤 Passing exact filename (generic):', exactFilenameToPass);
          }

          console.log('🔍 === PREPARING CONTENT FOR SFTP ===');
          console.log('🔍 config.uploadType:', config.uploadType);
          console.log('🔍 fileContent type:', typeof fileContent);
          console.log('🔍 fileContent length:', fileContent ? fileContent.length : 0);
          console.log('🔍 formatType:', formatType);

          let contentForSftp;
          if (config.uploadType === 'csv') {
            console.log('✅ Detected CSV upload type');
            contentForSftp = fileContent;
            console.log('📤 === PREPARING CSV FOR SFTP ===');
            console.log('📤 contentForSftp type:', typeof contentForSftp);
            console.log('📤 contentForSftp length:', contentForSftp.length);
            console.log('📤 contentForSftp preview (first 300 chars):', contentForSftp.substring(0, 300));
            console.log('📤 contentForSftp preview (last 200 chars):', contentForSftp.substring(Math.max(0, contentForSftp.length - 200)));

            if (!contentForSftp || contentForSftp.trim() === '') {
              console.error('❌ CRITICAL: contentForSftp is empty!');
              console.error('❌ fileContent was:', fileContent);
              throw new Error('CSV content is empty before SFTP upload');
            }
          } else if (contextData.extractedData && typeof contextData.extractedData === 'object') {
            console.log('✅ Detected object type, converting to JSON');
            contentForSftp = JSON.stringify(contextData.extractedData);
          } else {
            console.log('⚠️ No valid content found, using empty object');
            contentForSftp = '{}';
          }

          console.log('🔍 === FINAL contentForSftp CHECK ===');
          console.log('🔍 contentForSftp type:', typeof contentForSftp);
          console.log('🔍 contentForSftp length:', contentForSftp ? contentForSftp.length : 0);
          console.log('🔍 contentForSftp is empty?:', !contentForSftp || contentForSftp.trim() === '');

          const sftpUploadPayload = {
            sftpConfig: {
              host: sftpConfig.host,
              port: sftpConfig.port,
              username: sftpConfig.username,
              password: sftpConfig.password,
              xmlPath: sftpConfig.remote_path || '/ParseIt_XML',
              pdfPath: sftpConfig.pdf_path || '/ParseIt_PDF',
              jsonPath: sftpConfig.json_path || '/ParseIt_JSON',
              csvPath: sftpConfig.csv_path || '/ParseIt_CSV'
            },
            xmlContent: contentForSftp,
            pdfBase64: contextData.pdfBase64 || '',
            baseFilename: filename,
            originalFilename: contextData.originalPdfFilename || filename,
            formatType: formatType,
            uploadFileTypes: uploadFileTypes
          };

          if (exactFilenameToPass) {
            sftpUploadPayload.exactFilename = exactFilenameToPass;
            console.log('📤 Adding exactFilename to payload:', exactFilenameToPass);
          }

          console.log('📤 === SFTP UPLOAD PAYLOAD DEBUG ===');
          console.log('📤 Payload xmlContent type:', typeof sftpUploadPayload.xmlContent);
          console.log('📤 Payload xmlContent length:', sftpUploadPayload.xmlContent ? sftpUploadPayload.xmlContent.length : 0);
          console.log('📤 Payload xmlContent preview (first 300):', sftpUploadPayload.xmlContent ? sftpUploadPayload.xmlContent.substring(0, 300) : 'EMPTY');
          console.log('📤 Payload xmlContent preview (last 200):', sftpUploadPayload.xmlContent ? sftpUploadPayload.xmlContent.substring(Math.max(0, sftpUploadPayload.xmlContent.length - 200)) : 'EMPTY');
          console.log('📤 SFTP upload payload structure:', JSON.stringify({
            ...sftpUploadPayload,
            pdfBase64: `[${sftpUploadPayload.pdfBase64.length} chars]`,
            xmlContent: `[${sftpUploadPayload.xmlContent ? sftpUploadPayload.xmlContent.length : 0} chars]`
          }, null, 2));

          const sftpUploadResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(sftpUploadPayload)
          });

          console.log('📤 SFTP upload response status:', sftpUploadResponse.status);

          if (!sftpUploadResponse.ok) {
            const errorText = await sftpUploadResponse.text();
            console.error('❌ SFTP upload failed:', errorText);
            throw new Error(`SFTP upload failed: ${errorText}`);
          }

          const uploadResult = await sftpUploadResponse.json();
          console.log('✅ SFTP upload successful:', uploadResult);

          stepOutputData = { uploadResult, filename };

        } else if (step.step_type === 'email_action') {
          console.log('📧 === EXECUTING EMAIL ACTION STEP ===');
          const config = step.config_json || {};
          console.log('🔧 Email config:', JSON.stringify(config, null, 2));

          const processTemplateWithMapping = (template: string, contextData: any, templateName = 'template') => {
            const mappings: Record<string, any> = {};

            if (!template || !template.includes('{{')) {
              return { processed: template, mappings };
            }

            const templatePattern = /\{\{([^}]+)\}\}/g;
            const processed = template.replace(templatePattern, (match, path) => {
              const trimmedPath = path.trim();
              const value = getValueByPath(contextData, trimmedPath);
              mappings[trimmedPath] = value !== undefined ? value : null;

              if (typeof value === 'object' && value !== null) {
                return JSON.stringify(value);
              }
              return value !== undefined ? String(value) : match;
            });

            console.log(`\n📝 === TEMPLATE SUBSTITUTION: ${templateName} ===`);
            console.log('📋 Template:', template);
            console.log('🔍 Field Mappings:');
            Object.entries(mappings).forEach(([field, value]) => {
              const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
              console.log(`   ${field} → ${displayValue}`);
            });
            console.log('✅ Final Result:', processed);
            console.log('='.repeat(50));

            return { processed, mappings };
          };

          const allFieldMappings: Record<string, any> = {};
          const processedConfig: any = {};

          const toResult = processTemplateWithMapping(config.to, contextData, 'Email To');
          processedConfig.to = toResult.processed;
          Object.assign(allFieldMappings, toResult.mappings);

          const subjectResult = processTemplateWithMapping(config.subject, contextData, 'Email Subject');
          processedConfig.subject = subjectResult.processed;
          Object.assign(allFieldMappings, subjectResult.mappings);

          const bodyResult = processTemplateWithMapping(config.body, contextData, 'Email Body');
          processedConfig.body = bodyResult.processed;
          Object.assign(allFieldMappings, bodyResult.mappings);

          if (config.from) {
            const fromResult = processTemplateWithMapping(config.from, contextData, 'Email From');
            processedConfig.from = fromResult.processed;
            Object.assign(allFieldMappings, fromResult.mappings);
          }

          let pdfAttachment = null;
          if (config.includeAttachment && contextData.pdfBase64) {
            let attachmentFilename;
            const attachmentSource = config.attachmentSource || 'transform_setup_pdf';

            console.log('📧 Attachment source selected:', attachmentSource);
            console.log('📧 Available filenames in context:');
            console.log('  - renamedFilename (from rename step):', contextData.renamedFilename);
            console.log('  - transformSetupFilename (from transform setup):', contextData.transformSetupFilename);
            console.log('  - pdfFilename (current):', contextData.pdfFilename);
            console.log('  - originalPdfFilename:', contextData.originalPdfFilename);

            if (attachmentSource === 'renamed_pdf_step') {
              if (contextData.renamedFilename) {
                attachmentFilename = contextData.renamedFilename;
                console.log('📧 ✅ Using renamedFilename from rename step:', attachmentFilename);
              } else {
                attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf';
                console.log('📧 ⚠️  No renamedFilename from step, falling back to originalPdfFilename:', attachmentFilename);
              }
            } else if (attachmentSource === 'transform_setup_pdf') {
              if (contextData.transformSetupFilename) {
                attachmentFilename = contextData.transformSetupFilename;
                console.log('📧 ✅ Using transformSetupFilename from transform setup:', attachmentFilename);
              } else if (contextData.pdfFilename) {
                attachmentFilename = contextData.pdfFilename;
                console.log('📧 ✅ Using pdfFilename from transform setup:', attachmentFilename);
              } else {
                attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf';
                console.log('📧 ⚠️  No transform setup filename, falling back to originalPdfFilename:', attachmentFilename);
              }
            } else if (attachmentSource === 'original_pdf') {
              attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf';
              console.log('Using originalPdfFilename:', attachmentFilename);
            } else if (attachmentSource === 'extraction_type_filename') {
              if (contextData.extractionTypeFilename) {
                const filenameResult = processTemplateWithMapping(contextData.extractionTypeFilename, contextData, 'Extraction Type Filename');
                attachmentFilename = filenameResult.processed;
                Object.assign(allFieldMappings, filenameResult.mappings);
                console.log('Using extractionTypeFilename from extraction type:', attachmentFilename);
              } else {
                attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf';
                console.log('No extractionTypeFilename available, falling back to originalPdfFilename:', attachmentFilename);
              }
            } else {
              if (contextData.renamedFilename) {
                attachmentFilename = contextData.renamedFilename;
                console.log('📧 ✅ Using renamedFilename (legacy mode):', attachmentFilename);
              } else if (contextData.extractionTypeFilename) {
                const filenameResult = processTemplateWithMapping(contextData.extractionTypeFilename, contextData, 'Extraction Type Filename');
                attachmentFilename = filenameResult.processed;
                Object.assign(allFieldMappings, filenameResult.mappings);
                console.log('Using extractionTypeFilename from extraction type:', attachmentFilename);
              } else {
                attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf';
                console.log('📧 ⚠️  Using fallback to originalPdfFilename (legacy mode):', attachmentFilename);
              }
            }

            let pdfContent = contextData.pdfBase64;
            const pdfEmailStrategy = config.pdfEmailStrategy || 'all_pages_in_group';

            if (pdfEmailStrategy === 'specific_page_in_group' && config.specificPageToEmail) {
              const pageToEmail = config.specificPageToEmail;
              console.log(`📧 Extracting page ${pageToEmail} from PDF for email attachment`);

              try {
                pdfContent = await extractSpecificPageFromPdf(contextData.pdfBase64, pageToEmail);
                console.log(`📧 ✅ Successfully extracted page ${pageToEmail} from PDF`);
              } catch (extractError) {
                console.error(`📧 ❌ Failed to extract page ${pageToEmail}:`, extractError);
                throw new Error(`Failed to extract page ${pageToEmail} from PDF: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`);
              }
            } else {
              console.log('📧 Using full PDF (all pages in group) for email attachment');
            }

            pdfAttachment = {
              filename: attachmentFilename,
              content: pdfContent
            };

            console.log('📧 PDF attachment prepared with filename:', attachmentFilename);
          }

          let ccEmail = null;
          if (config.ccUser && contextData.userId) {
            console.log('📧 CC User enabled, fetching user email for userId:', contextData.userId);
            try {
              const userResponse = await fetch(
                `${supabaseUrl}/rest/v1/users?id=eq.${contextData.userId}&select=email`,
                {
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                    'apikey': supabaseServiceKey
                  }
                }
              );
              if (userResponse.ok) {
                const users = await userResponse.json();
                if (users && users.length > 0 && users[0].email) {
                  ccEmail = users[0].email;
                  console.log('📧 ✅ User email retrieved for CC:', ccEmail);
                } else {
                  console.log('📧 ⚠️ User email not found in database for userId:', contextData.userId);
                }
              } else {
                console.log('📧 ⚠️ Failed to fetch user email:', userResponse.status);
              }
            } catch (userError) {
              console.error('📧 ❌ Error fetching user email:', userError);
            }
          }

          console.log('\n📧 === FINAL EMAIL DETAILS ===');
          console.log('To:', processedConfig.to);
          console.log('CC:', ccEmail || 'none');
          console.log('Subject:', processedConfig.subject);
          console.log('From:', processedConfig.from || '(default)');
          console.log('Attachment:', pdfAttachment ? pdfAttachment.filename : 'none');
          console.log('='.repeat(50));

          const emailConfigResponse = await fetch(`${supabaseUrl}/rest/v1/email_monitoring_config?limit=1`, {
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            }
          });

          if (!emailConfigResponse.ok) {
            throw new Error('Email configuration not found');
          }

          const emailConfigData = await emailConfigResponse.json();
          if (!emailConfigData || emailConfigData.length === 0) {
            throw new Error('Email configuration not found');
          }

          const emailConfigRecord = emailConfigData[0];
          const emailConfig = {
            provider: emailConfigRecord.provider || 'office365',
            office365: emailConfigRecord.provider === 'office365' ? {
              tenant_id: emailConfigRecord.tenant_id,
              client_id: emailConfigRecord.client_id,
              client_secret: emailConfigRecord.client_secret,
              default_send_from_email: emailConfigRecord.monitored_email
            } : undefined,
            gmail: emailConfigRecord.provider === 'gmail' ? {
              client_id: emailConfigRecord.gmail_client_id,
              client_secret: emailConfigRecord.gmail_client_secret,
              refresh_token: emailConfigRecord.gmail_refresh_token,
              default_send_from_email: emailConfigRecord.monitored_email
            } : undefined
          };

          let emailResult;
          if (emailConfig.provider === 'office365') {
            emailResult = await sendOffice365Email(emailConfig.office365!, {
              to: processedConfig.to,
              subject: processedConfig.subject,
              body: processedConfig.body,
              from: processedConfig.from || emailConfig.office365!.default_send_from_email,
              cc: ccEmail
            }, pdfAttachment);
          } else {
            emailResult = await sendGmailEmail(emailConfig.gmail!, {
              to: processedConfig.to,
              subject: processedConfig.subject,
              body: processedConfig.body,
              from: processedConfig.from || emailConfig.gmail!.default_send_from_email,
              cc: ccEmail
            }, pdfAttachment);
          }

          if (!emailResult.success) {
            throw new Error(`Email sending failed: ${emailResult.error}`);
          }

          stepOutputData = {
            success: true,
            message: 'Email sent successfully',
            emailResult,
            processedConfig: {
              ...processedConfig,
              cc: ccEmail
            },
            fieldMappings: allFieldMappings,
            attachmentIncluded: !!pdfAttachment,
            attachmentFilename: pdfAttachment?.filename
          };

        } else if (step.step_type === 'conditional_check') {
          console.log('🔍 === EXECUTING CONDITIONAL CHECK STEP ===');
          const config = step.config_json || {};
          console.log('🔧 Conditional check config:', JSON.stringify(config, null, 2));

          const fieldPath = config.fieldPath || config.checkField || '';
          const operator = config.operator || 'exists';
          const expectedValue = config.expectedValue;
          const storeResultAs = config.storeResultAs || `condition_${step.step_order}_result`;

          console.log('🔍 Checking field:', fieldPath);
          console.log('🔍 Operator:', operator);
          console.log('🔍 Expected value:', expectedValue);

          const actualValue = getValueByPath(contextData, fieldPath);
          console.log('🔍 Actual value from context:', actualValue);
          console.log('🔍 Actual value type:', typeof actualValue);

          let conditionMet = false;

          switch (operator) {
            case 'exists':
              conditionMet = actualValue !== null && actualValue !== undefined && actualValue !== '';
              console.log(`🔍 Condition (exists): ${conditionMet}`);
              break;

            case 'not_exists':
            case 'notExists':
              conditionMet = actualValue === null || actualValue === undefined || actualValue === '';
              console.log(`🔍 Condition (not_exists): ${conditionMet}`);
              break;

            case 'equals':
            case 'eq':
              conditionMet = String(actualValue) === String(expectedValue);
              console.log(`🔍 Condition (equals): "${actualValue}" === "${expectedValue}" = ${conditionMet}`);
              break;

            case 'not_equals':
            case 'notEquals':
            case 'ne':
              conditionMet = String(actualValue) !== String(expectedValue);
              console.log(`🔍 Condition (not_equals): "${actualValue}" !== "${expectedValue}" = ${conditionMet}`);
              break;

            case 'contains':
              conditionMet = String(actualValue).includes(String(expectedValue));
              console.log(`🔍 Condition (contains): "${actualValue}".includes("${expectedValue}") = ${conditionMet}`);
              break;

            case 'not_contains':
            case 'notContains':
              conditionMet = !String(actualValue).includes(String(expectedValue));
              console.log(`🔍 Condition (not_contains): !("${actualValue}".includes("${expectedValue}")) = ${conditionMet}`);
              break;

            case 'greater_than':
            case 'gt':
              const gtActual = parseFloat(actualValue);
              const gtExpected = parseFloat(expectedValue);
              conditionMet = !isNaN(gtActual) && !isNaN(gtExpected) && gtActual > gtExpected;
              console.log(`🔍 Condition (greater_than): ${gtActual} > ${gtExpected} = ${conditionMet}`);
              break;

            case 'less_than':
            case 'lt':
              const ltActual = parseFloat(actualValue);
              const ltExpected = parseFloat(expectedValue);
              conditionMet = !isNaN(ltActual) && !isNaN(ltExpected) && ltActual < ltExpected;
              console.log(`🔍 Condition (less_than): ${ltActual} < ${ltExpected} = ${conditionMet}`);
              break;

            case 'greater_than_or_equal':
            case 'gte':
              const gteActual = parseFloat(actualValue);
              const gteExpected = parseFloat(expectedValue);
              conditionMet = !isNaN(gteActual) && !isNaN(gteExpected) && gteActual >= gteExpected;
              console.log(`🔍 Condition (greater_than_or_equal): ${gteActual} >= ${gteExpected} = ${conditionMet}`);
              break;

            case 'less_than_or_equal':
            case 'lte':
              const lteActual = parseFloat(actualValue);
              const lteExpected = parseFloat(expectedValue);
              conditionMet = !isNaN(lteActual) && !isNaN(lteExpected) && lteActual <= lteExpected;
              console.log(`🔍 Condition (less_than_or_equal): ${lteActual} <= ${lteExpected} = ${conditionMet}`);
              break;

            default:
              console.warn(`⚠️ Unknown operator: ${operator}, defaulting to 'exists'`);
              conditionMet = actualValue !== null && actualValue !== undefined && actualValue !== '';
          }

          contextData[storeResultAs] = conditionMet;
          console.log(`✅ Conditional check result stored as "${storeResultAs}": ${conditionMet}`);

          stepOutputData = {
            conditionMet,
            fieldPath,
            operator,
            actualValue,
            expectedValue,
            storeResultAs
          };

        } else if (step.step_type === 'rename_file' || step.step_type === 'rename_pdf') {
          console.log('📝 === EXECUTING RENAME FILE STEP ===');
          const config = step.config_json || {};
          console.log('🔧 Rename config:', JSON.stringify(config, null, 2));
          console.log('🔍 DEBUG - contextData keys at start of rename:', Object.keys(contextData));
          console.log('🔍 DEBUG - contextData.billNumber:', contextData.billNumber);
          console.log('🔍 DEBUG - lastApiResponse:', lastApiResponse);
          let template = config.filenameTemplate || contextData.pageGroupFilenameTemplate || contextData.extractionTypeFilename || config.template || 'Remit_{{pdfFilename}}';
          console.log('📄 Original template:', template);
          const placeholderRegex = /\{\{([^}]+)\}\}/g;
          let match;
          while((match = placeholderRegex.exec(template)) !== null){
            const placeholder = match[0];
            const path = match[1];
            let value = getValueByPath(contextData, path);
            console.log(`🔍 Replacing ${placeholder} (path: "${path}")`);
            console.log(`🔍   - Value from contextData:`, value);
            if ((value === null || value === undefined) && lastApiResponse) {
              value = getValueByPath(lastApiResponse, path);
              console.log(`🔍   - Fallback value from lastApiResponse:`, value);
            }
            if (value !== null && value !== undefined) {
              template = template.replace(placeholder, String(value));
              console.log(`🔍   - Replaced with:`, String(value));
            } else {
              console.log(`⚠️   - No value found for ${placeholder}`);
            }
          }
          console.log('📄 Template after replacements:', template);
          let baseFilename = template.replace(/\.(pdf|csv|json|xml)$/i, '');
          console.log('📄 Base filename (without extension):', baseFilename);
          const appendTimestamp = config.appendTimestamp === true;
          const timestampFormat = config.timestampFormat || 'YYYYMMDD';
          console.log('⏰ Append timestamp:', appendTimestamp);
          if (appendTimestamp) {
            console.log('⏰ Timestamp format:', timestampFormat);
          }
          let timestamp = '';
          if (appendTimestamp) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            switch(timestampFormat){
              case 'YYYYMMDD':
                timestamp = `${year}${month}${day}`;
                break;
              case 'YYYY-MM-DD':
                timestamp = `${year}-${month}-${day}`;
                break;
              case 'YYYYMMDD_HHMMSS':
                timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
                break;
              case 'YYYY-MM-DD_HH-MM-SS':
                timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
                break;
              default:
                timestamp = `${year}${month}${day}`;
            }
            console.log('⏰ Generated timestamp:', timestamp);
            baseFilename = `${baseFilename}_${timestamp}`;
            console.log('📄 Base filename with timestamp:', baseFilename);
          }
          const renamePdf = config.renamePdf === true;
          const renameCsv = config.renameCsv === true;
          const renameJson = config.renameJson === true;
          const renameXml = config.renameXml === true;
          console.log('📋 File types to rename:', {
            renamePdf,
            renameCsv,
            renameJson,
            renameXml
          });
          const renamedFilenames = {};
          if (renamePdf) {
            contextData.renamedPdfFilename = `${baseFilename}.pdf`;
            renamedFilenames.pdf = contextData.renamedPdfFilename;
            console.log('✅ Renamed PDF filename:', contextData.renamedPdfFilename);
          }
          if (renameCsv) {
            contextData.renamedCsvFilename = `${baseFilename}.csv`;
            renamedFilenames.csv = contextData.renamedCsvFilename;
            console.log('✅ Renamed CSV filename:', contextData.renamedCsvFilename);
          }
          if (renameJson) {
            contextData.renamedJsonFilename = `${baseFilename}.json`;
            renamedFilenames.json = contextData.renamedJsonFilename;
            console.log('✅ Renamed JSON filename:', contextData.renamedJsonFilename);
          }
          if (renameXml) {
            contextData.renamedXmlFilename = `${baseFilename}.xml`;
            renamedFilenames.xml = contextData.renamedXmlFilename;
            console.log('✅ Renamed XML filename:', contextData.renamedXmlFilename);
          }
          let primaryFilename = baseFilename;
          if (formatType === 'JSON' && renameJson) {
            primaryFilename = contextData.renamedJsonFilename;
          } else if (formatType === 'CSV' && renameCsv) {
            primaryFilename = contextData.renamedCsvFilename;
          } else if (formatType === 'XML' && renameXml) {
            primaryFilename = contextData.renamedXmlFilename;
          } else if (renamePdf) {
            primaryFilename = contextData.renamedPdfFilename;
          } else if (renameJson) {
            primaryFilename = contextData.renamedJsonFilename;
          } else if (renameCsv) {
            primaryFilename = contextData.renamedCsvFilename;
          } else if (renameXml) {
            primaryFilename = contextData.renamedXmlFilename;
          }
          contextData.renamedFilename = primaryFilename;
          contextData.actualFilename = primaryFilename;
          console.log('✅ Primary renamed filename:', primaryFilename);
          stepOutputData = {
            renamedFilenames,
            primaryFilename,
            baseFilename
          };

        } else {
          console.warn(`⚠️ Unknown step type: ${step.step_type}`);
          throw new Error(`Unknown step type: ${step.step_type}`);
        }
        const stepEndTime = new Date().toISOString();
        const stepDurationMs = Date.now() - stepStartMs;
        console.log(`✅ Step ${step.step_order} completed successfully in ${stepDurationMs}ms`);
        if (workflowExecutionLogId) {
          await createStepLog(supabaseUrl, supabaseServiceKey, workflowExecutionLogId, requestData.workflowId, step, 'completed', stepStartTime, stepEndTime, stepDurationMs, null, stepInputData, stepOutputData);
        }
        console.log(`✅ DEBUG - Completed iteration i=${i} for step ${step.step_order}. Moving to next iteration.`);
      } catch (stepError) {
        console.error(`❌ Step ${step.step_order} failed:`, stepError);
        const stepEndTime = new Date().toISOString();
        const stepDurationMs = Date.now() - stepStartMs;
        const errorMessage = stepError instanceof Error ? stepError.message : 'Unknown error';
        if (workflowExecutionLogId) {
          await createStepLog(supabaseUrl, supabaseServiceKey, workflowExecutionLogId, requestData.workflowId, step, 'failed', stepStartTime, stepEndTime, stepDurationMs, errorMessage, stepInputData, null);
        }
        console.log('🚫 DEBUG - Step', step.step_order, 'failed, throwing error and stopping workflow\n');
        throw stepError;
      }
    }
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
    return new Response(JSON.stringify({
      success: true,
      extractionLogId: extractionLogId,
      workflowExecutionLogId: workflowExecutionLogId,
      finalContext: contextData
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ === WORKFLOW EXECUTION ERROR ===');
    console.error('❌ Error type:', error?.constructor?.name);
    console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    if (workflowExecutionLogId) {
      await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        },
        body: JSON.stringify({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      });
    }
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

async function extractSpecificPageFromPdf(pdfBase64: string, pageNumber: number): Promise<string> {
  console.log(`📄 === EXTRACTING PAGE ${pageNumber} FROM PDF ===`);

  try {
    const { PDFDocument } = await import('npm:pdf-lib@1.17.1');

    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    console.log(`📄 Decoded PDF, size: ${pdfBytes.length} bytes`);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    console.log(`📄 PDF has ${totalPages} page(s)`);

    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new Error(
        `Invalid page number ${pageNumber}. PDF has ${totalPages} page(s). Page number must be between 1 and ${totalPages}.`
      );
    }

    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1]);
    newPdf.addPage(copiedPage);

    const newPdfBytes = await newPdf.save();
    console.log(`📄 Created new PDF with single page, size: ${newPdfBytes.length} bytes`);

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < newPdfBytes.length; i += chunkSize) {
      const chunk = newPdfBytes.subarray(i, Math.min(i + chunkSize, newPdfBytes.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }

    const newPdfBase64 = btoa(binary);
    console.log(`📄 ✅ Successfully extracted page ${pageNumber}/${totalPages}`);

    return newPdfBase64;
  } catch (error) {
    console.error('📄 ❌ PDF extraction failed:', error);
    throw error;
  }
}

async function getOffice365AccessToken(config: { tenant_id: string; client_id: string; client_secret: string }): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: config.client_id,
    client_secret: config.client_secret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Office365 access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendOffice365Email(
  config: { tenant_id: string; client_id: string; client_secret: string; default_send_from_email: string },
  email: { to: string; subject: string; body: string; from: string; cc?: string | null },
  attachment: { filename: string; content: string } | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getOffice365AccessToken(config);

    const message: any = {
      message: {
        subject: email.subject,
        body: {
          contentType: 'HTML',
          content: email.body
        },
        toRecipients: [
          {
            emailAddress: {
              address: email.to
            }
          }
        ],
        from: {
          emailAddress: {
            address: email.from
          }
        },
        ...(email.cc ? {
          ccRecipients: [
            {
              emailAddress: {
                address: email.cc
              }
            }
          ]
        } : {})
      },
      saveToSentItems: 'true'
    };

    if (attachment) {
      message.message.attachments = [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.filename,
          contentType: 'application/pdf',
          contentBytes: attachment.content
        }
      ];
    }

    const sendUrl = `https://graph.microsoft.com/v1.0/users/${email.from}/sendMail`;

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function getGmailAccessToken(config: { client_id: string; client_secret: string; refresh_token: string }): Promise<string> {
  const tokenUrl = 'https://oauth2.googleapis.com/token';

  const params = new URLSearchParams({
    client_id: config.client_id,
    client_secret: config.client_secret,
    refresh_token: config.refresh_token,
    grant_type: 'refresh_token'
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Gmail access token: ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function sendGmailEmail(
  config: { client_id: string; client_secret: string; refresh_token: string; default_send_from_email: string },
  email: { to: string; subject: string; body: string; from: string; cc?: string | null },
  attachment: { filename: string; content: string } | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await getGmailAccessToken(config);

    let emailContent;

    if (attachment) {
      const boundary = '----=_Part_' + Date.now();
      const emailLines = [
        `To: ${email.to}`,
        ...(email.cc ? [`Cc: ${email.cc}`] : []),
        `From: ${email.from}`,
        `Subject: ${email.subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        '',
        email.body,
        '',
        `--${boundary}`,
        `Content-Type: application/pdf; name="${attachment.filename}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${attachment.filename}"`,
        '',
        attachment.content,
        '',
        `--${boundary}--`
      ];
      emailContent = emailLines.join('\r\n');
    } else {
      emailContent = [
        `From: ${email.from}`,
        `To: ${email.to}`,
        ...(email.cc ? [`Cc: ${email.cc}`] : []),
        `Subject: ${email.subject}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        email.body
      ].join('\r\n');
    }

    const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sendUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodedEmail })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}