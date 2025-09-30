import { supabase } from '../lib/supabase';
import type { ExtractionLog, EmailPollingLog, WorkflowExecutionLog, SftpPollingLog, ProcessedEmail } from '../types';

// Extraction Logs
export async function fetchExtractionLogs(): Promise<ExtractionLog[]> {
  try {
    const { data, error } = await supabase
      .from('extraction_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map(log => ({
      id: log.id,
      userId: log.user_id,
      extractionTypeId: log.extraction_type_id,
      transformationTypeId: log.transformation_type_id,
      pdfFilename: log.pdf_filename,
      pdfPages: log.pdf_pages,
      extractionStatus: log.extraction_status,
      errorMessage: log.error_message,
      createdAt: log.created_at,
      apiResponse: log.api_response,
      apiStatusCode: log.api_status_code,
      apiError: log.api_error,
      extractedData: log.extracted_data,
      processingMode: log.processing_mode
    }));
  } catch (error) {
    console.error('Error fetching extraction logs:', error);
    throw error;
  }
}

export async function refreshLogsWithFilters(filters: {
  statusFilter: string;
  userFilter: string;
  typeFilter: string;
  processingModeFilter: string;
  fromDate: string;
  toDate: string;
}): Promise<ExtractionLog[]> {
  try {
    let query = supabase
      .from('extraction_logs')
      .select('*');

    // Apply filters
    if (filters.statusFilter !== 'all') {
      query = query.eq('extraction_status', filters.statusFilter);
    }

    if (filters.userFilter !== 'all') {
      query = query.eq('user_id', filters.userFilter);
    }

    if (filters.processingModeFilter !== 'all') {
      query = query.eq('processing_mode', filters.processingModeFilter);
    }

    if (filters.typeFilter !== 'all') {
      const [mode, typeId] = filters.typeFilter.split('-');
      if (mode === 'extraction') {
        query = query.eq('extraction_type_id', typeId);
      } else if (mode === 'transformation') {
        query = query.eq('transformation_type_id', typeId);
      }
    }

    if (filters.fromDate) {
      query = query.gte('created_at', filters.fromDate);
    }

    if (filters.toDate) {
      const toDateEnd = new Date(filters.toDate);
      toDateEnd.setHours(23, 59, 59, 999);
      query = query.lte('created_at', toDateEnd.toISOString());
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    return (data || []).map(log => ({
      id: log.id,
      userId: log.user_id,
      extractionTypeId: log.extraction_type_id,
      transformationTypeId: log.transformation_type_id,
      pdfFilename: log.pdf_filename,
      pdfPages: log.pdf_pages,
      extractionStatus: log.extraction_status,
      errorMessage: log.error_message,
      createdAt: log.created_at,
      apiResponse: log.api_response,
      apiStatusCode: log.api_status_code,
      apiError: log.api_error,
      extractedData: log.extracted_data,
      processingMode: log.processing_mode
    }));
  } catch (error) {
    console.error('Error refreshing logs with filters:', error);
    throw error;
  }
}

export async function logExtraction(
  extractionTypeId: string | null,
  transformationTypeId: string | null,
  pdfFilename: string,
  pdfPages: number,
  status: 'success' | 'failed',
  errorMessage?: string,
  userId?: string,
  apiResponse?: string,
  apiStatusCode?: number,
  apiError?: string,
  extractedData?: string,
  processingMode: 'extraction' | 'transformation' = 'extraction'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('extraction_logs')
      .insert([{
        user_id: userId || null,
        extraction_type_id: extractionTypeId,
        transformation_type_id: transformationTypeId,
        pdf_filename: pdfFilename,
        pdf_pages: pdfPages,
        extraction_status: status,
        error_message: errorMessage || null,
        api_response: apiResponse || null,
        api_status_code: apiStatusCode || null,
        api_error: apiError || null,
        extracted_data: extractedData || null,
        processing_mode: processingMode,
        created_at: new Date().toISOString()
      }]);

    if (error) throw error;
  } catch (error) {
    console.error('Error logging extraction:', error);
    throw error;
  }
}

// Email Polling Logs
export async function fetchEmailPollingLogs(): Promise<EmailPollingLog[]> {
  try {
    const { data, error } = await supabase
      .from('email_polling_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      provider: log.provider,
      status: log.status,
      emailsFound: log.emails_found,
      emailsProcessed: log.emails_processed,
      errorMessage: log.error_message,
      executionTimeMs: log.execution_time_ms,
      createdAt: log.created_at
    }));
  } catch (error) {
    console.error('Error fetching email polling logs:', error);
    throw error;
  }
}

// Workflow Execution Logs
export async function fetchWorkflowExecutionLogs(): Promise<WorkflowExecutionLog[]> {
  try {
    const { data, error } = await supabase
      .from('workflow_execution_logs')
      .select(`
        id,
        extraction_log_id,
        workflow_id,
        status,
        current_step_id,
        current_step_name,
        error_message,
        started_at,
        updated_at,
        completed_at
      `)
      .order('started_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map(log => ({
      id: log.id,
      extractionLogId: log.extraction_log_id,
      workflowId: log.workflow_id,
      status: log.status,
      currentStepId: log.current_step_id,
      currentStepName: log.current_step_name,
      errorMessage: log.error_message,
      contextData: null, // Will be loaded on demand
      startedAt: log.started_at,
      updatedAt: log.updated_at,
      completedAt: log.completed_at
    }));
  } catch (error) {
    console.error('Error fetching workflow execution logs:', error);
    throw error;
  }
}

export async function fetchWorkflowExecutionLogById(id: string): Promise<WorkflowExecutionLog | null> {
  try {
    const { data, error } = await supabase
      .from('workflow_execution_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      extractionLogId: data.extraction_log_id,
      workflowId: data.workflow_id,
      status: data.status,
      currentStepId: data.current_step_id,
      currentStepName: data.current_step_name,
      errorMessage: data.error_message,
      contextData: data.context_data,
      startedAt: data.started_at,
      updatedAt: data.updated_at,
      completedAt: data.completed_at
    };
  } catch (error) {
    console.error('Error fetching workflow execution log by ID:', error);
    throw error;
  }
}

// SFTP Polling Logs
export async function fetchSftpPollingLogs(): Promise<SftpPollingLog[]> {
  try {
    const { data, error } = await supabase
      .from('sftp_polling_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map(log => ({
      id: log.id,
      configId: log.config_id,
      timestamp: log.timestamp,
      status: log.status,
      filesFound: log.files_found,
      filesProcessed: log.files_processed,
      errorMessage: log.error_message,
      executionTimeMs: log.execution_time_ms,
      createdAt: log.created_at
    }));
  } catch (error) {
    console.error('Error fetching SFTP polling logs:', error);
    throw error;
  }
}

// Processed Emails
export async function fetchProcessedEmails(): Promise<ProcessedEmail[]> {
  try {
    const { data, error } = await supabase
      .from('processed_emails')
      .select('*')
      .order('received_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map(email => ({
      id: email.id,
      emailId: email.email_id,
      sender: email.sender,
      subject: email.subject,
      receivedDate: email.received_date,
      processingRuleId: email.processing_rule_id,
      extractionTypeId: email.extraction_type_id,
      pdfFilename: email.pdf_filename,
      processingStatus: email.processing_status,
      errorMessage: email.error_message,
      parseitId: email.parseit_id,
      processedAt: email.processed_at
    }));
  } catch (error) {
    console.error('Error fetching processed emails:', error);
    throw error;
  }
}