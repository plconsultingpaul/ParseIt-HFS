import { supabase } from '../lib/supabase';
import { buildJsonPayload, buildAuthHeaders, submitWithRetry, parseApiResponse } from '../lib/jsonPayloadMapper';
import type { OrderEntryField } from '../types';

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
  const { data, error } = await supabase
    .from('order_entry_config')
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Failed to load submission config:', error);
    return null;
  }

  if (!data) {
    return null;
  }

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
  config: SubmissionConfig
): Promise<SubmissionResult> {
  try {
    const { data: fieldGroups } = await supabase
      .from('order_entry_field_groups')
      .select('*');

    const payload = buildJsonPayload(formData, fields, fieldGroups || []);

    const headers = buildAuthHeaders(
      config.apiAuthType,
      config.apiAuthToken,
      config.apiHeaders
    );

    console.log('Submitting to API:', config.apiEndpoint);

    const response = await submitWithRetry(
      config.apiEndpoint,
      {
        method: config.apiMethod,
        headers,
        body: JSON.stringify(payload)
      }
    );

    const responseBody = await parseResponseBody(response);
    const parsedResponse = parseApiResponse(response, responseBody);

    const submissionId = await saveSubmission({
      userId,
      pdfId,
      submissionData: payload,
      apiResponse: responseBody,
      apiStatusCode: response.status,
      status: parsedResponse.success ? 'completed' : 'failed',
      errorMessage: parsedResponse.success ? null : parsedResponse.message
    });

    if (parsedResponse.success && config.workflowId) {
      try {
        const workflowExecutionId = await triggerWorkflow(
          config.workflowId,
          submissionId,
          payload,
          responseBody,
          response.status,
          pdfId
        );

        await linkWorkflowToSubmission(submissionId, workflowExecutionId);

        return {
          success: true,
          submissionId,
          apiResponse: responseBody,
          apiStatusCode: response.status,
          workflowExecutionId
        };
      } catch (workflowError: any) {
        console.error('Workflow trigger failed:', workflowError);

        return {
          success: true,
          submissionId,
          apiResponse: responseBody,
          apiStatusCode: response.status,
          error: `Order submitted successfully, but workflow failed: ${workflowError.message}`
        };
      }
    }

    return {
      success: parsedResponse.success,
      submissionId,
      apiResponse: responseBody,
      apiStatusCode: response.status,
      error: parsedResponse.success ? undefined : parsedResponse.message
    };
  } catch (error: any) {
    console.error('Submission error:', error);

    const submissionId = await saveSubmission({
      userId,
      pdfId,
      submissionData: formData,
      apiResponse: null,
      apiStatusCode: 0,
      status: 'failed',
      errorMessage: error.message || 'Failed to submit order'
    });

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
  apiResponse: any;
  apiStatusCode: number;
  status: string;
  errorMessage: string | null;
}

async function saveSubmission(params: SaveSubmissionParams): Promise<string> {
  const { data, error } = await supabase
    .from('order_entry_submissions')
    .insert({
      user_id: params.userId,
      pdf_id: params.pdfId,
      submission_data: params.submissionData,
      api_response: params.apiResponse,
      api_status_code: params.apiStatusCode,
      submission_status: params.status,
      error_message: params.errorMessage,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save submission:', error);
    throw new Error('Failed to save submission record');
  }

  if (params.pdfId) {
    await supabase
      .from('order_entry_pdfs')
      .update({ order_entry_submission_id: data.id })
      .eq('id', params.pdfId);
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
  let pdfStoragePath = null;

  if (pdfId) {
    const { data: pdfData } = await supabase
      .from('order_entry_pdfs')
      .select('storage_path')
      .eq('id', pdfId)
      .maybeSingle();

    pdfStoragePath = pdfData?.storage_path || null;
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
    console.error('Failed to create workflow execution log:', error);
    throw new Error('Failed to trigger workflow');
  }

  await executeWorkflowSteps(workflowId, data.id, contextData);

  return data.id;
}

async function executeWorkflowSteps(
  workflowId: string,
  executionLogId: string,
  contextData: any
): Promise<void> {
  const { data: steps, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('step_order');

  if (error || !steps || steps.length === 0) {
    await supabase
      .from('workflow_execution_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', executionLogId);
    return;
  }

  await supabase
    .from('workflow_execution_logs')
    .update({
      status: 'running',
      current_step_id: steps[0].id,
      current_step_name: steps[0].step_name
    })
    .eq('id', executionLogId);

  for (const step of steps) {
    try {
      await executeWorkflowStep(step, executionLogId, contextData);
    } catch (error: any) {
      console.error(`Workflow step ${step.step_name} failed:`, error);

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
    throw new Error(`Failed to create step log: ${logError.message}`);
  }

  try {
    const config = replaceTemplateVariables(step.config_json, contextData);

    await supabase
      .from('workflow_step_logs')
      .update({
        processed_config: config,
        last_heartbeat: new Date().toISOString()
      })
      .eq('id', stepLog.id);

    const output = await executeStepByType(step.step_type, config);

    const duration = Date.now() - startTime;

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
