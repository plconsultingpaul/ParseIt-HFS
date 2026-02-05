import { EmailMessage, PdfAttachment, EmailMonitoringConfig, ProcessingRule } from '../../index.ts';

export interface EmailProvider {
  readonly providerName: string;

  authenticate(): Promise<string>;

  fetchUnreadEmails(): Promise<EmailMessage[]>;

  findPdfAttachments(emailId: string): Promise<PdfAttachment[]>;

  getEmailDetails(emailId: string): Promise<{
    subject: string;
    from: string;
    receivedDate: string;
  }>;

  applyPostProcessAction(
    emailId: string,
    action: string,
    folderPath: string
  ): Promise<void>;
}

export function findMatchingRule(
  fromEmail: string,
  subject: string,
  rules: ProcessingRule[]
): ProcessingRule | null {
  for (const rule of rules) {
    const senderMatches = !rule.sender_pattern ||
      fromEmail.toLowerCase().includes(rule.sender_pattern.toLowerCase());

    const subjectMatches = !rule.subject_pattern ||
      subject.toLowerCase().includes(rule.subject_pattern.toLowerCase());

    if (senderMatches && subjectMatches) {
      return rule;
    }
  }
  return null;
}

export function getPostProcessAction(
  config: EmailMonitoringConfig,
  processResult: 'success' | 'failure'
): { action: string; folderPath: string } {
  const action = processResult === 'success'
    ? (config.post_process_action || 'mark_read')
    : (config.post_process_action_on_failure || 'none');

  const folderPath = processResult === 'success'
    ? (config.processed_folder_path || 'Processed')
    : (config.failure_folder_path || 'Failed');

  return { action, folderPath };
}
