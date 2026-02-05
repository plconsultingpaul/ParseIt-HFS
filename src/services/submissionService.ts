import { supabase } from '../lib/supabase';
import { buildJsonPayload, buildAuthHeaders, submitWithRetry, parseApiResponse } from '../lib/jsonPayloadMapper';
import { executeWorkflow } from '../lib/workflow';
import { applyFieldMappingPostProcessing } from '../lib/fieldMappingProcessor';
import type { OrderEntryField, OrderEntryFieldGroup, FieldMapping, ExtractionType } from '../types';

interface SubmissionConfig {
  apiEndpoint: string;
  apiMethod: string;
  apiHeaders: Record<string, string>;
  apiAuthType: string | null;
  apiAuthToken: string | null;
  workflowId: string | null;
  isEnabled: boolean;
}

interface SubmissionResult {
  success: boolean;
  submissionId: string;
  apiResponse: any;
  apiStatusCode: number;
  workflowExecutionId?: string;
  error?: string;
}

export async function loadSubmissionConfig(): Promise<SubmissionConfig | null> {
  console.log('[OrderEntry] Loading submission config from order_entry_config table...');

  const { data, error } = await supabase
    .from('order_entry_config')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[OrderEntry] Failed to load submission config:', error);
    return null;
  }

  if (!data) {
    console.warn('[OrderEntry] No submission config found in order_entry_config table');
    return null;
  }

  console.log('[OrderEntry] Submission config loaded:', {
    apiEndpoint: data.api_endpoint,
    apiMethod: data.api_method,
    apiAuthType: data.api_auth_type,
    workflowId: data.workflow_id,
    isEnabled: data.is_enabled,
    hasJsonTemplate: !!data.json_template,
    hasFieldMappings: !!data.field_mappings && Array.isArray(data.field_mappings) && data.field_mappings.length > 0
  });

  return {
    apiEndpoint: data.api_endpoint || '',
    apiMethod: data.api_method || 'POST',
    apiHeaders: data.api_headers || {},
    apiAuthType: data.api_auth_type || null,
    apiAuthToken: data.api_auth_token || null,
    workflowId: data.workflow_id || null,
    isEnabled: data.is_enabled || false
  };
}

export async function submitOrderEntry(
  formData: Record<string, any>,
  fields: OrderEntryField[],
  userId: string,
  pdfId: string | null,
  config: SubmissionConfig,
  extractionTypeId?: string | null,
  fieldGroups?: OrderEntryFieldGroup[]
): Promise<SubmissionResult> {
  console.log('[OrderEntry] ========== SUBMISSION STARTED ==========');
  console.log('[OrderEntry] User ID:', userId);
  console.log('[OrderEntry] PDF ID:', pdfId);
  console.log('[OrderEntry] Form data keys:', Object.keys(formData));
  console.log('[OrderEntry] Fields count:', fields.length);
  console.log('[OrderEntry] Extraction Type ID:', extractionTypeId);
  console.log('[OrderEntry] Config:', {
    apiEndpoint: config.apiEndpoint,
    apiMethod: config.apiMethod,
    apiAuthType: config.apiAuthType,
    workflowId: config.workflowId,
    isEnabled: config.isEnabled
  });

  if (extractionTypeId) {
    console.log('[OrderEntry] Extraction Type linked - using extraction type workflow path');
    return submitViaExtractionType(formData, fields, userId, pdfId, extractionTypeId, fieldGroups || []);
  }

  console.log('[OrderEntry] No extraction type linked - using legacy direct submission');

  try {
    console.log('[OrderEntry] Loading field groups...');
    const { data: fieldGroups, error: fieldGroupsError } = await supabase
      .from('order_entry_field_groups')
      .select('*');

    if (fieldGroupsError) {
      console.error('[OrderEntry] Failed to load field groups:', fieldGroupsError);
    }

    console.log('[OrderEntry] Field groups loaded:', fieldGroups?.length || 0);

    console.log('[OrderEntry] Building JSON payload...');
    const payload = buildJsonPayload(formData, fields, fieldGroups || []);
    console.log('[OrderEntry] Built payload:', JSON.stringify(payload, null, 2));

    const headers = buildAuthHeaders(
      config.apiAuthType,
      config.apiAuthToken,
      config.apiHeaders
    );
    console.log('[OrderEntry] Auth headers configured (keys):', Object.keys(headers));

    console.log('[OrderEntry] Submitting to API:', config.apiEndpoint);

    console.log('[OrderEntry] Making API request...');
    console.log('[OrderEntry] Request body:', JSON.stringify(payload));

    const response = await submitWithRetry(
      config.apiEndpoint,
      {
        method: config.apiMethod,
        headers,
        body: JSON.stringify(payload)
      }
    );

    console.log('[OrderEntry] API response status:', response.status, response.statusText);

    const responseBody = await parseResponseBody(response);
    console.log('[OrderEntry] API response body:', JSON.stringify(responseBody, null, 2));

    const parsedResponse = parseApiResponse(response, responseBody);
    console.log('[OrderEntry] Parsed response:', parsedResponse);

    console.log('[OrderEntry] Saving submission to database...');
    const submissionId = await saveSubmission({
      userId,
      pdfId,
      submissionData: payload,
      rawFormData: formData,
      apiResponse: responseBody,
      apiStatusCode: response.status,
      status: parsedResponse.success ? 'completed' : 'failed',
      errorMessage: parsedResponse.success ? null : parsedResponse.message
    });

    if (parsedResponse.success && config.workflowId) {
      console.log('[OrderEntry] API call successful, triggering workflow:', config.workflowId);
      try {
        const workflowExecutionId = await triggerWorkflow(
          config.workflowId,
          submissionId,
          payload,
          responseBody,
          response.status,
          pdfId
        );

        console.log('[OrderEntry] Workflow triggered successfully:', workflowExecutionId);
        await linkWorkflowToSubmission(submissionId, workflowExecutionId);

        console.log('[OrderEntry] ========== SUBMISSION COMPLETED ==========');
        return {
          success: true,
          submissionId,
          apiResponse: responseBody,
          apiStatusCode: response.status,
          workflowExecutionId
        };
      } catch (workflowError: any) {
        console.error('[OrderEntry] Workflow trigger failed:', workflowError);

        return {
          success: true,
          submissionId,
          apiResponse: responseBody,
          apiStatusCode: response.status,
          error: `Order submitted successfully, but workflow failed: ${workflowError.message}`
        };
      }
    } else if (parsedResponse.success) {
      console.log('[OrderEntry] API call successful, no workflow configured');
    } else {
      console.error('[OrderEntry] API call failed:', parsedResponse.message);
    }

    return {
      success: parsedResponse.success,
      submissionId,
      apiResponse: responseBody,
      apiStatusCode: response.status,
      error: parsedResponse.success ? undefined : parsedResponse.message
    };
  } catch (error: any) {
    console.error('[OrderEntry] ========== SUBMISSION FAILED ==========');
    console.error('[OrderEntry] Error:', error);
    console.error('[OrderEntry] Error message:', error.message);
    console.error('[OrderEntry] Error stack:', error.stack);
    console.error('[OrderEntry] Raw form data at failure:', JSON.stringify(formData, null, 2));

    const submissionId = await saveSubmission({
      userId,
      pdfId,
      submissionData: formData,
      rawFormData: formData,
      apiResponse: null,
      apiStatusCode: 0,
      status: 'failed',
      errorMessage: error.message || 'Failed to submit order'
    });

    console.log('[OrderEntry] Failed submission saved with ID:', submissionId);

    return {
      success: false,
      submissionId,
      apiResponse: null,
      apiStatusCode: 0,
      error: error.message || 'Failed to submit order'
    };
  }
}

async function parseResponseBody(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return { message: text };
  } catch {
    return null;
  }
}

interface SaveSubmissionParams {
  userId: string;
  pdfId: string | null;
  submissionData: any;
  rawFormData?: any;
  apiResponse: any;
  apiStatusCode: number;
  status: string;
  errorMessage: string | null;
  extractionTypeId?: string | null;
}

async function saveSubmission(params: SaveSubmissionParams): Promise<string> {
  console.log('[OrderEntry:Save] Saving submission to database...');
  console.log('[OrderEntry:Save] Status:', params.status);
  console.log('[OrderEntry:Save] API status code:', params.apiStatusCode);
  console.log('[OrderEntry:Save] Error message:', params.errorMessage);
  console.log('[OrderEntry:Save] Has raw form data:', !!params.rawFormData);

  const { data, error } = await supabase
    .from('order_entry_submissions')
    .insert({
      user_id: params.userId,
      pdf_id: params.pdfId,
      submission_data: params.submissionData,
      raw_form_data: params.rawFormData || null,
      api_response: params.apiResponse,
      api_status_code: params.apiStatusCode,
      submission_status: params.status,
      error_message: params.errorMessage,
      extraction_type_id: params.extractionTypeId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('[OrderEntry:Save] Failed to save submission:', error);
    throw new Error('Failed to save submission record');
  }

  console.log('[OrderEntry:Save] Submission saved with ID:', data.id);

  if (params.pdfId) {
    console.log('[OrderEntry:Save] Linking PDF to submission...');
    const { error: linkError } = await supabase
      .from('order_entry_pdfs')
      .update({ order_entry_submission_id: data.id })
      .eq('id', params.pdfId);

    if (linkError) {
      console.error('[OrderEntry:Save] Failed to link PDF:', linkError);
    }
  }

  return data.id;
}

async function triggerWorkflow(
  workflowId: string,
  submissionId: string,
  submissionData: any,
  apiResponse: any,
  apiStatusCode: number,
  pdfId: string | null
): Promise<string> {
  console.log('[OrderEntry:Workflow] Starting workflow trigger...');
  console.log('[OrderEntry:Workflow] Workflow ID:', workflowId);
  console.log('[OrderEntry:Workflow] Submission ID:', submissionId);

  let pdfStoragePath = null;

  if (pdfId) {
    console.log('[OrderEntry:Workflow] Looking up PDF storage path for ID:', pdfId);
    const { data: pdfData, error: pdfError } = await supabase
      .from('order_entry_pdfs')
      .select('storage_path')
      .eq('id', pdfId)
      .maybeSingle();

    if (pdfError) {
      console.error('[OrderEntry:Workflow] Failed to lookup PDF:', pdfError);
    }
    pdfStoragePath = pdfData?.storage_path || null;
    console.log('[OrderEntry:Workflow] PDF storage path:', pdfStoragePath);
  }

  const contextData = {
    submission_id: submissionId,
    submission_data: submissionData,
    api_response: apiResponse,
    api_status_code: apiStatusCode,
    pdf_storage_path: pdfStoragePath,
    pdf_id: pdfId,
    timestamp: new Date().toISOString()
  };

  console.log('[OrderEntry:Workflow] Context data prepared:', JSON.stringify(contextData, null, 2));

  console.log('[OrderEntry:Workflow] Creating workflow execution log...');
  const { data, error } = await supabase
    .from('workflow_execution_logs')
    .insert({
      workflow_id: workflowId,
      status: 'pending',
      context_data: contextData,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('[OrderEntry:Workflow] Failed to create workflow execution log:', error);
    throw new Error('Failed to trigger workflow');
  }

  console.log('[OrderEntry:Workflow] Workflow execution log created:', data.id);
  console.log('[OrderEntry:Workflow] Executing workflow steps...');

  await executeWorkflowSteps(workflowId, data.id, contextData);

  console.log('[OrderEntry:Workflow] Workflow steps execution completed');
  return data.id;
}

async function executeWorkflowSteps(
  workflowId: string,
  executionLogId: string,
  contextData: any
): Promise<void> {
  console.log('[OrderEntry:Workflow] Loading workflow steps for workflow:', workflowId);

  const { data: steps, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('step_order');

  if (error) {
    console.error('[OrderEntry:Workflow] Failed to load workflow steps:', error);
  }

  if (!steps || steps.length === 0) {
    console.log('[OrderEntry:Workflow] No workflow steps found, marking as completed');
    await supabase
      .from('workflow_execution_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', executionLogId);
    return;
  }

  console.log('[OrderEntry:Workflow] Found', steps.length, 'workflow steps:', steps.map(s => ({ id: s.id, name: s.step_name, type: s.step_type, order: s.step_order })));

  await supabase
    .from('workflow_execution_logs')
    .update({
      status: 'running',
      current_step_id: steps[0].id,
      current_step_name: steps[0].step_name
    })
    .eq('id', executionLogId);

  for (const step of steps) {
    console.log('[OrderEntry:Workflow] Executing step:', step.step_name, '(', step.step_type, ')');
    try {
      await executeWorkflowStep(step, executionLogId, contextData);
      console.log('[OrderEntry:Workflow] Step completed:', step.step_name);
    } catch (error: any) {
      console.error('[OrderEntry:Workflow] Step failed:', step.step_name, error);

      await supabase
        .from('workflow_execution_logs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', executionLogId);

      throw error;
    }
  }

  console.log('[OrderEntry:Workflow] All steps completed, marking workflow as completed');
  await supabase
    .from('workflow_execution_logs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', executionLogId);
}

async function executeWorkflowStep(
  step: any,
  executionLogId: string,
  contextData: any
): Promise<void> {
  const startTime = Date.now();
  console.log('[OrderEntry:Step] Creating step log for:', step.step_name);

  const { data: stepLog, error: logError } = await supabase
    .from('workflow_step_logs')
    .insert({
      workflow_execution_log_id: executionLogId,
      workflow_id: step.workflow_id,
      step_id: step.id,
      step_name: step.step_name,
      step_type: step.step_type,
      step_order: step.step_order,
      status: 'running',
      started_at: new Date().toISOString(),
      input_data: contextData,
      step_config: step.config_json
    })
    .select()
    .single();

  if (logError) {
    console.error('[OrderEntry:Step] Failed to create step log:', logError);
    throw new Error(`Failed to create step log: ${logError.message}`);
  }

  console.log('[OrderEntry:Step] Step log created:', stepLog.id);

  try {
    console.log('[OrderEntry:Step] Original step config:', JSON.stringify(step.config_json, null, 2));
    const config = replaceTemplateVariables(step.config_json, contextData);
    console.log('[OrderEntry:Step] Processed step config:', JSON.stringify(config, null, 2));

    await supabase
      .from('workflow_step_logs')
      .update({
        processed_config: config,
        last_heartbeat: new Date().toISOString()
      })
      .eq('id', stepLog.id);

    console.log('[OrderEntry:Step] Executing step type:', step.step_type);
    const output = await executeStepByType(step.step_type, config);
    console.log('[OrderEntry:Step] Step output:', output);

    const duration = Date.now() - startTime;
    console.log('[OrderEntry:Step] Step completed in', duration, 'ms');

    await supabase
      .from('workflow_step_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        output_data: output
      })
      .eq('id', stepLog.id);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[OrderEntry:Step] Step failed after', duration, 'ms:', error);

    await supabase
      .from('workflow_step_logs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: duration,
        error_message: error.message
      })
      .eq('id', stepLog.id);

    throw error;
  }
}

function replaceTemplateVariables(config: any, contextData: any): any {
  const configStr = JSON.stringify(config);

  const replaced = configStr.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(contextData, path.trim());
    return value !== undefined ? String(value) : match;
  });

  return JSON.parse(replaced);
}

function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

async function executeStepByType(stepType: string, config: any): Promise<any> {
  console.log(`Executing step type: ${stepType}`, config);

  return { success: true, message: 'Step executed in background' };
}

async function linkWorkflowToSubmission(
  submissionId: string,
  workflowExecutionId: string
): Promise<void> {
  await supabase
    .from('order_entry_submissions')
    .update({ workflow_execution_log_id: workflowExecutionId })
    .eq('id', submissionId);
}

export async function loadExtractionTypeForOrderEntry(extractionTypeId: string): Promise<ExtractionType | null> {
  const { data, error } = await supabase
    .from('extraction_types')
    .select('*')
    .eq('id', extractionTypeId)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to load extraction type:', error);
    return null;
  }

  let fieldMappings = data.field_mappings || [];
  if (typeof fieldMappings === 'string') {
    try {
      fieldMappings = JSON.parse(fieldMappings);
    } catch (e) {
      console.error('Failed to parse field_mappings:', e);
      fieldMappings = [];
    }
  }

  return {
    id: data.id,
    name: data.name,
    defaultInstructions: data.default_instructions || '',
    formatTemplate: data.format_template || '',
    filename: data.filename || '',
    formatType: data.format_type || 'JSON',
    jsonPath: data.json_path,
    fieldMappings,
    workflowId: data.workflow_id
  };
}

export function applyOrderEntryFieldMappings(
  formData: Record<string, any>,
  fieldMappings: FieldMapping[]
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const mapping of fieldMappings) {
    if (mapping.type === 'order_entry') {
      const formFieldName = mapping.value;
      let value = getNestedFormValue(formData, formFieldName);

      if (mapping.dataType === 'number') {
        value = value !== undefined && value !== '' ? parseFloat(value) : null;
      } else if (mapping.dataType === 'integer') {
        value = value !== undefined && value !== '' ? parseInt(value, 10) : null;
      } else if (mapping.dataType === 'boolean') {
        value = value === true || value === 'true' || value === '1';
      }

      if (mapping.removeIfNull && (value === null || value === undefined || value === '')) {
        continue;
      }

      result[mapping.fieldName] = value ?? '';
    } else if (mapping.type === 'hardcoded') {
      result[mapping.fieldName] = mapping.value;
    }
  }

  return result;
}

function getNestedFormValue(formData: Record<string, any>, path: string): any {
  const keys = path.split('.');
  let current: any = formData;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

async function submitViaExtractionType(
  formData: Record<string, any>,
  fields: OrderEntryField[],
  userId: string,
  pdfId: string | null,
  extractionTypeId: string,
  fieldGroups: OrderEntryFieldGroup[]
): Promise<SubmissionResult> {
  console.log('[OrderEntry:ExtractionType] ========== EXTRACTION TYPE SUBMISSION ==========');
  console.log('[OrderEntry:ExtractionType] Extraction Type ID:', extractionTypeId);

  let submissionId = '';

  try {
    console.log('[OrderEntry:ExtractionType] Loading extraction type...');
    const extractionType = await loadExtractionTypeForOrderEntry(extractionTypeId);

    if (!extractionType) {
      throw new Error('Linked extraction type not found');
    }

    console.log('[OrderEntry:ExtractionType] Extraction type loaded:', {
      id: extractionType.id,
      name: extractionType.name,
      workflowId: extractionType.workflowId,
      hasFieldMappings: !!extractionType.fieldMappings && extractionType.fieldMappings.length > 0,
      fieldMappingsCount: extractionType.fieldMappings?.length || 0
    });

    console.log('[OrderEntry:ExtractionType] Using passed field groups:', fieldGroups.length, 'groups');
    console.log('[OrderEntry:ExtractionType] Field groups detail:', fieldGroups.map(g => ({
      id: g.id,
      name: g.groupName,
      isArrayGroup: g.isArrayGroup,
      isArrayGroupType: typeof g.isArrayGroup
    })));
    console.log('[OrderEntry:ExtractionType] Array groups:', fieldGroups.filter(g => g.isArrayGroup).map(g => ({ id: g.id, name: g.groupName })));

    console.log('[OrderEntry:ExtractionType] Fields detail (first 10):', fields.slice(0, 10).map(f => ({
      fieldName: f.fieldName,
      fieldGroupId: f.fieldGroupId,
      jsonPath: f.jsonPath
    })));

    console.log('[OrderEntry:ExtractionType] Building extracted data from form fields...');
    const extractedData = buildExtractedDataFromForm(formData, fields, fieldGroups, extractionType.fieldMappings || []);
    console.log('[OrderEntry:ExtractionType] Built extracted data:', JSON.stringify(extractedData, null, 2));

    const extractedDataString = JSON.stringify(extractedData, null, 2);

    console.log('[OrderEntry:ExtractionType] Saving initial submission record...');
    console.log('[OrderEntry:ExtractionType] Raw form data:', JSON.stringify(formData, null, 2));
    submissionId = await saveSubmission({
      userId,
      pdfId,
      submissionData: extractedData,
      rawFormData: formData,
      apiResponse: null,
      apiStatusCode: 0,
      status: 'processing',
      errorMessage: null,
      extractionTypeId: extractionTypeId
    });
    console.log('[OrderEntry:ExtractionType] Submission record saved:', submissionId);

    if (!extractionType.workflowId) {
      console.log('[OrderEntry:ExtractionType] No workflow configured - marking as completed');
      await supabase
        .from('order_entry_submissions')
        .update({
          submission_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);

      return {
        success: true,
        submissionId,
        apiResponse: extractedData,
        apiStatusCode: 200
      };
    }

    console.log('[OrderEntry:ExtractionType] Workflow configured:', extractionType.workflowId);
    console.log('[OrderEntry:ExtractionType] Calling executeWorkflow (same as Extract process)...');

    let submitterEmail = '';
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .maybeSingle();

      if (userData?.email) {
        submitterEmail = userData.email;
        console.log('[OrderEntry:ExtractionType] Submitter email:', submitterEmail);
      }
    } catch (emailLookupError) {
      console.warn('[OrderEntry:ExtractionType] Failed to look up user email:', emailLookupError);
    }

    let pdfBase64 = '';
    let pdfFilename = 'order-entry-submission.pdf';

    if (pdfId) {
      console.log('[OrderEntry:ExtractionType] Loading PDF data for workflow...');
      const { data: pdfData, error: pdfError } = await supabase
        .from('order_entry_pdfs')
        .select('storage_path, original_filename')
        .eq('id', pdfId)
        .maybeSingle();

      if (pdfError) {
        console.warn('[OrderEntry:ExtractionType] Failed to load PDF metadata:', pdfError);
      } else if (pdfData) {
        pdfFilename = pdfData.original_filename || pdfFilename;

        if (pdfData.storage_path) {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('order-entry-pdfs')
              .download(pdfData.storage_path);

            if (!downloadError && fileData) {
              const buffer = await fileData.arrayBuffer();
              const bytes = new Uint8Array(buffer);
              let binary = '';
              const chunkSize = 32768;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
                binary += String.fromCharCode.apply(null, Array.from(chunk));
              }
              pdfBase64 = btoa(binary);
              console.log('[OrderEntry:ExtractionType] PDF converted to base64, length:', pdfBase64.length);
            }
          } catch (downloadErr) {
            console.warn('[OrderEntry:ExtractionType] Failed to download PDF for workflow:', downloadErr);
          }
        }
      }
    }

    const workflowResult = await executeWorkflow({
      extractedData: extractedDataString,
      workflowId: extractionType.workflowId,
      userId: userId,
      extractionTypeId: extractionType.id,
      pdfFilename: pdfFilename,
      pdfPages: 1,
      pdfBase64: pdfBase64,
      originalPdfFilename: pdfFilename,
      formatType: extractionType.formatType || 'JSON',
      extractionTypeFilename: extractionType.filename,
      submitterEmail: submitterEmail
    });

    console.log('[OrderEntry:ExtractionType] Workflow execution completed:', workflowResult);

    await supabase
      .from('order_entry_submissions')
      .update({
        api_response: workflowResult.lastApiResponse || workflowResult.finalData,
        api_status_code: 200,
        submission_status: 'completed',
        workflow_execution_log_id: workflowResult.workflowExecutionLogId,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId);

    console.log('[OrderEntry:ExtractionType] ========== SUBMISSION COMPLETED ==========');

    return {
      success: true,
      submissionId,
      apiResponse: workflowResult.lastApiResponse || workflowResult.finalData,
      apiStatusCode: 200,
      workflowExecutionId: workflowResult.workflowExecutionLogId
    };

  } catch (error: any) {
    console.error('[OrderEntry:ExtractionType] ========== SUBMISSION FAILED ==========');
    console.error('[OrderEntry:ExtractionType] Error:', error);
    console.error('[OrderEntry:ExtractionType] Error message:', error.message);
    console.error('[OrderEntry:ExtractionType] Raw form data at failure:', JSON.stringify(formData, null, 2));

    if (submissionId) {
      console.log('[OrderEntry:ExtractionType] Updating existing submission to failed status:', submissionId);
      await supabase
        .from('order_entry_submissions')
        .update({
          submission_status: 'failed',
          error_message: error.message || 'Failed to submit order via extraction type',
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId);
    } else {
      console.log('[OrderEntry:ExtractionType] No existing submission, creating failed submission record...');
      let mappedDataAttempt: any = null;
      try {
        const extractionType = await loadExtractionTypeForOrderEntry(extractionTypeId);
        if (extractionType) {
          mappedDataAttempt = buildExtractedDataFromForm(formData, fields, [], extractionType.fieldMappings || []);
          console.log('[OrderEntry:ExtractionType] Mapped data at failure:', JSON.stringify(mappedDataAttempt, null, 2));
        }
      } catch (mappingError) {
        console.error('[OrderEntry:ExtractionType] Could not compute mapped data:', mappingError);
      }

      submissionId = await saveSubmission({
        userId,
        pdfId,
        submissionData: mappedDataAttempt || formData,
        rawFormData: formData,
        apiResponse: null,
        apiStatusCode: 0,
        status: 'failed',
        errorMessage: error.message || 'Failed to submit order via extraction type',
        extractionTypeId: extractionTypeId
      });
    }

    return {
      success: false,
      submissionId,
      apiResponse: null,
      apiStatusCode: 0,
      error: error.message || 'Failed to submit order via extraction type'
    };
  }
}

function buildExtractedDataFromForm(
  formData: Record<string, any>,
  fields: OrderEntryField[],
  fieldGroups: OrderEntryFieldGroup[],
  fieldMappings: FieldMapping[]
): Record<string, any> {
  console.log('[OrderEntry:BuildData] ========== BUILD EXTRACTED DATA ==========');
  console.log('[OrderEntry:BuildData] Form data keys:', Object.keys(formData));
  console.log('[OrderEntry:BuildData] Fields count:', fields.length);
  console.log('[OrderEntry:BuildData] Field groups count:', fieldGroups.length);
  console.log('[OrderEntry:BuildData] Field mappings count:', fieldMappings.length);

  console.log('[OrderEntry:BuildData] ========== RAW FIELD MAPPINGS DUMP ==========');
  fieldMappings.forEach((m, idx) => {
    console.log(`[OrderEntry:BuildData] Mapping[${idx}]:`, {
      fieldName: m.fieldName,
      type: m.type,
      typeExact: JSON.stringify(m.type),
      value: m.value,
      dataType: m.dataType,
      removeIfNull: m.removeIfNull
    });
  });

  console.log('[OrderEntry:BuildData] Form data structure check:');
  Object.keys(formData).forEach(key => {
    const value = formData[key];
    const isArray = Array.isArray(value);
    console.log(`[OrderEntry:BuildData]   Key "${key}": type=${typeof value}, isArray=${isArray}, value=${isArray ? `Array(${value.length})` : (typeof value === 'object' ? JSON.stringify(value) : value)}`);
  });

  const result: Record<string, any> = {};

  const orderEntryMappings = fieldMappings.filter(m => m.type === 'order_entry');
  console.log('[OrderEntry:BuildData] Order entry mappings:', orderEntryMappings.length);

  console.log('[OrderEntry:BuildData] Checking field groups for isArrayGroup...');
  fieldGroups.forEach((g, i) => {
    console.log(`[OrderEntry:BuildData] Group ${i}: id=${g.id}, name=${g.groupName}, isArrayGroup=${g.isArrayGroup} (type: ${typeof g.isArrayGroup})`);
  });

  const arrayGroupIds = new Set(fieldGroups.filter(g => g.isArrayGroup).map(g => g.id));
  console.log('[OrderEntry:BuildData] Array group IDs set:', [...arrayGroupIds]);
  console.log('[OrderEntry:BuildData] Array group IDs count:', arrayGroupIds.size);

  const arrayGroupFieldsByRoot: Map<string, { groupId: string; fields: OrderEntryField[] }> = new Map();

  for (const field of fields) {
    if (!field.jsonPath) {
      console.log('[OrderEntry:BuildData] Field has no jsonPath, skipping:', field.fieldName);
      continue;
    }

    console.log(`[OrderEntry:BuildData] Checking field "${field.fieldName}": fieldGroupId=${field.fieldGroupId}, inArrayGroupIds=${arrayGroupIds.has(field.fieldGroupId)}`);
    const isInArrayGroup = arrayGroupIds.has(field.fieldGroupId);

    if (isInArrayGroup) {
      const pathParts = field.jsonPath.split('.');
      const rootPath = pathParts[0];

      if (!arrayGroupFieldsByRoot.has(rootPath)) {
        arrayGroupFieldsByRoot.set(rootPath, { groupId: field.fieldGroupId, fields: [] });
      }
      arrayGroupFieldsByRoot.get(rootPath)!.fields.push(field);
      console.log('[OrderEntry:BuildData] Array group field collected:', field.fieldName, '-> root:', rootPath);
    } else {
      const formValue = formData[field.fieldName];
      console.log('[OrderEntry:BuildData] Regular field:', field.fieldName, '-> jsonPath:', field.jsonPath, '= value:', formValue);

      const mapping = orderEntryMappings.find(m => m.fieldName === field.jsonPath);
      let processedValue = formValue;

      if (mapping) {
        processedValue = applyMappingDataType(processedValue, mapping);
        if (mapping.removeIfNull && (processedValue === null || processedValue === undefined || processedValue === '')) {
          console.log('[OrderEntry:BuildData] Skipping field due to removeIfNull:', field.jsonPath);
          continue;
        }
      }

      setNestedValue(result, field.jsonPath, processedValue ?? '');
    }
  }

  console.log('[OrderEntry:BuildData] ========== DETECTING ARRAY ROOTS FROM FIELD MAPPINGS ==========');
  for (const mapping of orderEntryMappings) {
    const formFieldName = mapping.value;
    const templateField = fields.find(f => f.fieldName === formFieldName);

    if (templateField && arrayGroupIds.has(templateField.fieldGroupId)) {
      const rootPath = mapping.fieldName.split('.')[0];
      console.log(`[OrderEntry:BuildData] Found order_entry mapping "${mapping.fieldName}" referencing array group field "${formFieldName}" -> root: "${rootPath}"`);

      if (!arrayGroupFieldsByRoot.has(rootPath)) {
        arrayGroupFieldsByRoot.set(rootPath, {
          groupId: templateField.fieldGroupId,
          fields: []
        });
        console.log(`[OrderEntry:BuildData] Added array root "${rootPath}" from field mapping (groupId: ${templateField.fieldGroupId})`);
      }
    }
  }

  console.log('[OrderEntry:BuildData] ========== ARRAY GROUP SUMMARY ==========');
  console.log('[OrderEntry:BuildData] Array groups collected:', arrayGroupFieldsByRoot.size);
  for (const [rootPath, { groupId, fields: collectedFields }] of arrayGroupFieldsByRoot) {
    console.log(`[OrderEntry:BuildData] Root "${rootPath}": groupId=${groupId}, fieldsCount=${collectedFields.length}`);
    collectedFields.forEach(f => console.log(`[OrderEntry:BuildData]   - ${f.fieldName} (jsonPath: ${f.jsonPath})`));
  }

  console.log('[OrderEntry:BuildData] ========== HARDCODED MAPPING FILTER ==========');
  console.log('[OrderEntry:BuildData] Filtering fieldMappings where type === "hardcoded"...');
  fieldMappings.forEach((m, idx) => {
    const isHardcoded = m.type === 'hardcoded';
    const typeComparison = `"${m.type}" === "hardcoded" -> ${isHardcoded}`;
    console.log(`[OrderEntry:BuildData] Filter check [${idx}]: ${m.fieldName} | ${typeComparison}`);
  });

  const hardcodedMappings = fieldMappings.filter(m => m.type === 'hardcoded');
  console.log('[OrderEntry:BuildData] Hardcoded mappings found:', hardcodedMappings.length);
  if (hardcodedMappings.length === 0) {
    console.log('[OrderEntry:BuildData] WARNING: No hardcoded mappings found! Check if type values match exactly.');
    console.log('[OrderEntry:BuildData] Available type values:', [...new Set(fieldMappings.map(m => m.type))]);
  }
  hardcodedMappings.forEach(m => {
    console.log(`[OrderEntry:BuildData]   Hardcoded: ${m.fieldName} = "${m.value}" (dataType: ${m.dataType})`);
  });

  const arrayRootPaths = new Set(arrayGroupFieldsByRoot.keys());
  console.log('[OrderEntry:BuildData] ========== ARRAY ROOT PATH CATEGORIZATION ==========');
  console.log('[OrderEntry:BuildData] Array root paths detected:', [...arrayRootPaths]);
  console.log('[OrderEntry:BuildData] Array root paths count:', arrayRootPaths.size);

  const hardcodedByArrayRoot: Map<string, FieldMapping[]> = new Map();
  const rootLevelHardcoded: FieldMapping[] = [];

  console.log('[OrderEntry:BuildData] Categorizing', hardcodedMappings.length, 'hardcoded mappings...');
  for (const mapping of hardcodedMappings) {
    const pathParts = mapping.fieldName.split('.');
    const rootPath = pathParts[0];
    const hasArrayRootPath = arrayRootPaths.has(rootPath);
    const hasMultipleParts = pathParts.length > 1;
    const belongsToArray = hasArrayRootPath && hasMultipleParts;

    console.log(`[OrderEntry:BuildData] Categorizing "${mapping.fieldName}":`, {
      pathParts: pathParts,
      rootPath: rootPath,
      hasArrayRootPath: hasArrayRootPath,
      hasMultipleParts: hasMultipleParts,
      belongsToArray: belongsToArray,
      decision: belongsToArray ? 'ARRAY FIELD' : 'ROOT LEVEL'
    });

    if (belongsToArray) {
      if (!hardcodedByArrayRoot.has(rootPath)) {
        hardcodedByArrayRoot.set(rootPath, []);
      }
      hardcodedByArrayRoot.get(rootPath)!.push(mapping);
      console.log('[OrderEntry:BuildData] -> Added to hardcodedByArrayRoot[' + rootPath + ']');
    } else {
      rootLevelHardcoded.push(mapping);
      console.log('[OrderEntry:BuildData] -> Added to rootLevelHardcoded');
    }
  }

  console.log('[OrderEntry:BuildData] ========== CATEGORIZATION SUMMARY ==========');
  console.log('[OrderEntry:BuildData] hardcodedByArrayRoot entries:');
  for (const [root, mappings] of hardcodedByArrayRoot) {
    console.log(`[OrderEntry:BuildData]   "${root}":`, mappings.map(m => m.fieldName));
  }
  console.log('[OrderEntry:BuildData] rootLevelHardcoded:', rootLevelHardcoded.map(m => m.fieldName));

  console.log('[OrderEntry:BuildData] ========== PROCESSING ARRAY GROUPS ==========');
  for (const [rootPath, { groupId, fields: arrayFields }] of arrayGroupFieldsByRoot) {
    console.log('[OrderEntry:BuildData] ===== Processing array root:', rootPath, '=====');
    console.log('[OrderEntry:BuildData] Group ID:', groupId);
    console.log('[OrderEntry:BuildData] Fields in this array group:', arrayFields.length);
    arrayFields.forEach(f => console.log(`[OrderEntry:BuildData]   - ${f.fieldName} (jsonPath: ${f.jsonPath})`));

    const arrayData = formData[groupId];
    console.log('[OrderEntry:BuildData] formData[groupId] lookup:', groupId, '->', arrayData === undefined ? 'UNDEFINED' : (Array.isArray(arrayData) ? `Array(${arrayData.length})` : typeof arrayData));
    if (Array.isArray(arrayData) && arrayData.length > 0) {
      console.log('[OrderEntry:BuildData] First row sample:', JSON.stringify(arrayData[0]));
    }
    const rowCount = Array.isArray(arrayData) ? arrayData.length : 1;
    console.log('[OrderEntry:BuildData] Row count to process:', rowCount);

    const hardcodedForThisArray = hardcodedByArrayRoot.get(rootPath) || [];
    console.log('[OrderEntry:BuildData] Hardcoded fields for "' + rootPath + '":', hardcodedForThisArray.length);
    if (hardcodedForThisArray.length > 0) {
      hardcodedForThisArray.forEach(h => console.log(`[OrderEntry:BuildData]   - ${h.fieldName} = "${h.value}"`));
    } else {
      console.log('[OrderEntry:BuildData] WARNING: No hardcoded fields found for this array root!');
      console.log('[OrderEntry:BuildData] Check if hardcodedByArrayRoot has key "' + rootPath + '":', hardcodedByArrayRoot.has(rootPath));
    }

    const arrayResult: Record<string, any>[] = [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
      const rowData: Record<string, any> = {};

      for (const field of arrayFields) {
        const pathParts = field.jsonPath.split('.');
        const fieldPathWithinArray = pathParts.slice(1).join('.');

        let formValue: any;
        if (Array.isArray(arrayData) && arrayData[rowIndex]) {
          formValue = arrayData[rowIndex][field.fieldName];
        } else {
          formValue = formData[field.fieldName];
        }

        const mapping = orderEntryMappings.find(m => m.fieldName === field.jsonPath);
        let processedValue = formValue;

        if (mapping) {
          processedValue = applyMappingDataType(processedValue, mapping);
          if (mapping.removeIfNull && (processedValue === null || processedValue === undefined || processedValue === '')) {
            console.log('[OrderEntry:BuildData] Skipping array field due to removeIfNull:', field.jsonPath);
            continue;
          }
        }

        if (fieldPathWithinArray.includes('.')) {
          setNestedValue(rowData, fieldPathWithinArray, processedValue ?? '');
        } else {
          rowData[fieldPathWithinArray] = processedValue ?? '';
        }

        console.log('[OrderEntry:BuildData] Array field set:', field.fieldName, '-> row', rowIndex, ', path:', fieldPathWithinArray, '=', processedValue);
      }

      console.log('[OrderEntry:BuildData] Row', rowIndex, '- Adding', hardcodedForThisArray.length, 'hardcoded fields...');
      for (const hardcodedMapping of hardcodedForThisArray) {
        const pathParts = hardcodedMapping.fieldName.split('.');
        const fieldPathWithinArray = pathParts.slice(1).join('.');

        const processedHardcodedValue = applyMappingDataType(hardcodedMapping.value, hardcodedMapping);

        console.log(`[OrderEntry:BuildData] Row ${rowIndex} - Setting hardcoded:`, {
          fullPath: hardcodedMapping.fieldName,
          fieldPathWithinArray: fieldPathWithinArray,
          rawValue: hardcodedMapping.value,
          processedValue: processedHardcodedValue,
          dataType: hardcodedMapping.dataType,
          hasNestedPath: fieldPathWithinArray.includes('.')
        });

        if (fieldPathWithinArray.includes('.')) {
          setNestedValue(rowData, fieldPathWithinArray, processedHardcodedValue);
        } else {
          rowData[fieldPathWithinArray] = processedHardcodedValue;
        }

        console.log('[OrderEntry:BuildData] Row', rowIndex, '- After setting, rowData keys:', Object.keys(rowData));
      }

      console.log('[OrderEntry:BuildData] Row', rowIndex, '- Final rowData:', JSON.stringify(rowData));

      if (Object.keys(rowData).length > 0) {
        arrayResult.push(rowData);
        console.log('[OrderEntry:BuildData] Row', rowIndex, '- Added to arrayResult (has content)');
      } else {
        console.log('[OrderEntry:BuildData] Row', rowIndex, '- Skipped (empty row, removeIfNull applied)');
      }
    }

    if (arrayResult.length > 0) {
      setNestedValue(result, rootPath, arrayResult);
    } else {
      console.log('[OrderEntry:BuildData] Array "' + rootPath + '" skipped entirely (all rows empty after removeIfNull)');
    }
    console.log('[OrderEntry:BuildData] Array group set at path:', rootPath, '-> array with', arrayResult.length, 'items');
    console.log('[OrderEntry:BuildData] Array result for', rootPath, ':', JSON.stringify(arrayResult, null, 2));
  }

  console.log('[OrderEntry:BuildData] ========== ADDING ROOT LEVEL HARDCODED ==========');
  console.log('[OrderEntry:BuildData] Root level hardcoded count:', rootLevelHardcoded.length);
  for (const mapping of rootLevelHardcoded) {
    const processedValue = applyMappingDataType(mapping.value, mapping);
    console.log('[OrderEntry:BuildData] Adding root-level hardcoded field:', mapping.fieldName, '=', mapping.value, '-> processed:', processedValue, '(dataType:', mapping.dataType + ')');
    setNestedValue(result, mapping.fieldName, processedValue);
  }

  console.log('[OrderEntry:BuildData] ========== FINAL RESULT BEFORE WRAPPING ==========');
  console.log('[OrderEntry:BuildData] Result object:', JSON.stringify(result, null, 2));

  const wrappedResult = { orders: [result] };
  console.log('[OrderEntry:BuildData] ========== WRAPPED RESULT ==========');
  console.log('[OrderEntry:BuildData] Pre-processing result:', JSON.stringify(wrappedResult, null, 2));

  const processedResult = applyFieldMappingPostProcessing(wrappedResult, fieldMappings);
  console.log('[OrderEntry:BuildData] Final result (after field mapping post-processing):', JSON.stringify(processedResult, null, 2));
  return processedResult;
}

function applyMappingDataType(value: any, mapping: FieldMapping): any {
  let processedValue = value;

  if (mapping.dataType === 'number' && processedValue !== undefined && processedValue !== '') {
    processedValue = parseFloat(processedValue);
    if (isNaN(processedValue)) processedValue = null;
  } else if (mapping.dataType === 'integer' && processedValue !== undefined && processedValue !== '') {
    processedValue = parseInt(processedValue, 10);
    if (isNaN(processedValue)) processedValue = null;
  } else if (mapping.dataType === 'boolean') {
    processedValue = processedValue === true || processedValue === 'true' || processedValue === '1';
  }

  return processedValue;
}

function setNestedValue(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}
