import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ProcessedEmailResult, PdfAttachment, ProcessingRule } from '../../index.ts';

export class LoggingService {
  private supabase: SupabaseClient;
  private pollingLogId: string | null = null;
  private startTime: number;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.startTime = Date.now();
  }

  async createPollingLog(provider: string): Promise<string | null> {
    const { data: logData, error: logError } = await this.supabase
      .from('email_polling_logs')
      .insert({
        provider,
        status: 'running',
        emails_found: 0,
        emails_processed: 0
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create polling log:', logError);
      throw logError;
    }

    this.pollingLogId = logData.id;
    console.log('Created polling log with ID:', this.pollingLogId);
    return this.pollingLogId;
  }

  async updatePollingLog(updates: Record<string, any>): Promise<void> {
    console.log('Updating polling log with:', updates);
    if (!this.pollingLogId) {
      console.error('No polling log ID available for update');
      return;
    }

    const { error: updateError } = await this.supabase
      .from('email_polling_logs')
      .update(updates)
      .eq('id', this.pollingLogId);

    if (updateError) {
      console.error('Failed to update polling log:', updateError);
    } else {
      console.log('Successfully updated polling log');
    }
  }

  async markPollingSuccess(emailsChecked: number, emailsProcessed: number, emailsFailed: number): Promise<void> {
    await this.updatePollingLog({
      status: 'success',
      emails_found: emailsChecked,
      emails_processed: emailsProcessed,
      emails_failed: emailsFailed,
      execution_time_ms: Date.now() - this.startTime
    });
  }

  async markPollingFailed(errorMessage: string): Promise<void> {
    await this.updatePollingLog({
      status: 'failed',
      error_message: errorMessage,
      execution_time_ms: Date.now() - this.startTime
    });
  }

  async createExtractionLog(
    extractionTypeId: string,
    pdfFilename: string
  ): Promise<string> {
    const { data: newLog, error: logInsertError } = await this.supabase
      .from('extraction_logs')
      .insert({
        user_id: null,
        extraction_type_id: extractionTypeId,
        pdf_filename: pdfFilename,
        pdf_pages: 1,
        extraction_status: 'running',
        created_at: new Date().toISOString(),
        extracted_data: null,
        api_response: null,
        api_status_code: null,
        api_error: null,
        error_message: null
      })
      .select()
      .single();

    if (logInsertError) {
      console.error('Failed to create extraction log:', logInsertError);
      throw new Error(`Failed to create extraction log: ${logInsertError.message}`);
    }

    return newLog.id;
  }

  async updateExtractionLog(
    extractionLogId: string,
    updates: {
      extracted_data?: string;
      api_response?: string | null;
      api_status_code?: number;
      extraction_status?: 'success' | 'failed' | 'running';
      error_message?: string | null;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('extraction_logs')
      .update(updates)
      .eq('id', extractionLogId);

    if (error) {
      console.error('Failed to update extraction log:', error);
    }
  }

  async logProcessedEmail(
    result: ProcessedEmailResult,
    attachments: PdfAttachment[],
    matchingRule: ProcessingRule | null,
    parseitId: number | null
  ): Promise<void> {
    await this.supabase
      .from('processed_emails')
      .insert({
        email_id: result.id,
        sender: result.from,
        subject: result.subject,
        received_date: result.receivedDate,
        processing_rule_id: matchingRule?.id || null,
        extraction_type_id: matchingRule?.extraction_types?.id || null,
        pdf_filename: attachments[0]?.filename || null,
        attachment_count: attachments.length,
        pdf_filenames: attachments.map(a => a.filename).join(', ') || null,
        attachment_page_counts: attachments.map(a => a.pageCount || 1).join(', ') || null,
        processing_status: result.processedSuccessfully ? 'completed' : 'failed',
        error_message: result.errorMessage,
        parseit_id: parseitId || null,
        processed_at: new Date().toISOString()
      });
  }

  getExecutionTimeMs(): number {
    return Date.now() - this.startTime;
  }

  getPollingLogId(): string | null {
    return this.pollingLogId;
  }
}
