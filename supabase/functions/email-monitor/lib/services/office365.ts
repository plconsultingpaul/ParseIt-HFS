import { EmailProvider } from './email-base.ts';
import { EmailMessage, PdfAttachment, EmailMonitoringConfig } from '../../index.ts';
import { getPdfPageCount } from '../pdf.ts';

export class Office365Provider implements EmailProvider {
  readonly providerName = 'office365';
  private config: EmailMonitoringConfig;
  private accessToken: string = '';

  constructor(config: EmailMonitoringConfig) {
    this.config = config;
  }

  async authenticate(): Promise<string> {
    const tenantId = this.config.monitoring_tenant_id || this.config.tenant_id;
    const clientId = this.config.monitoring_client_id || this.config.client_id;
    const clientSecret = this.config.monitoring_client_secret || this.config.client_secret;

    console.log('Using Office365 monitoring credentials:', {
      usingDedicatedCredentials: !!(this.config.monitoring_tenant_id && this.config.monitoring_client_id && this.config.monitoring_client_secret),
      tenantIdSource: this.config.monitoring_tenant_id ? 'monitoring' : 'send',
      clientIdSource: this.config.monitoring_client_id ? 'monitoring' : 'send'
    });

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to get Office365 token:', errorText);
      throw new Error(`Failed to get Office365 access token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    this.accessToken = tokenData.access_token;
    console.log('Office365 access token obtained successfully');
    return this.accessToken;
  }

  async fetchUnreadEmails(): Promise<EmailMessage[]> {
    let filter = 'hasAttachments eq true and isRead eq false';
    if (!this.config.check_all_messages && this.config.last_check) {
      const lastCheckDate = new Date(this.config.last_check).toISOString();
      filter += ` and receivedDateTime gt ${lastCheckDate}`;
    }

    console.log('Office365 filter:', filter);

    const emailsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/mailFolders/Inbox/messages?$filter=${encodeURIComponent(filter)}&$select=id,subject,from,receivedDateTime,hasAttachments`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!emailsResponse.ok) {
      const errorText = await emailsResponse.text();
      console.error('Office365 emails fetch failed:', errorText);
      throw new Error(`Failed to fetch Office365 emails: ${errorText}`);
    }

    const emailsData = await emailsResponse.json();
    const emails = emailsData.value || [];
    console.log('Found', emails.length, 'Office365 emails');

    return emails.map((email: any) => ({
      id: email.id,
      subject: email.subject || '',
      from: email.from?.emailAddress?.address || '',
      receivedDate: email.receivedDateTime || ''
    }));
  }

  async getEmailDetails(emailId: string): Promise<{
    subject: string;
    from: string;
    receivedDate: string;
  }> {
    const messageResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/messages/${emailId}?$select=subject,from,receivedDateTime`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      throw new Error(`Failed to fetch message details: ${errorText}`);
    }

    const email = await messageResponse.json();
    return {
      subject: email.subject || '',
      from: email.from?.emailAddress?.address || '',
      receivedDate: email.receivedDateTime || ''
    };
  }

  async findPdfAttachments(emailId: string): Promise<PdfAttachment[]> {
    const attachments: PdfAttachment[] = [];

    try {
      const attachmentsResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/messages/${emailId}/attachments`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (attachmentsResponse.ok) {
        const attachmentsData = await attachmentsResponse.json();

        for (const attachment of attachmentsData.value) {
          if (attachment.name && attachment.name.toLowerCase().endsWith('.pdf')) {
            const pageCount = await getPdfPageCount(attachment.contentBytes);

            attachments.push({
              filename: attachment.name,
              base64: attachment.contentBytes,
              pageCount
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Office365 attachments:', error);
    }

    return attachments;
  }

  async applyPostProcessAction(emailId: string, action: string, folderPath: string): Promise<void> {
    console.log(`Applying Office365 post-process action: ${action}`);

    if (action === 'none') {
      console.log('Post-process action is "none", skipping');
      return;
    }

    try {
      switch (action) {
        case 'mark_read':
          await this.markAsRead(emailId);
          break;

        case 'move':
          await this.moveToFolder(emailId, folderPath);
          await this.markAsRead(emailId);
          break;

        case 'archive':
          await this.archive(emailId);
          break;

        case 'delete':
          await this.moveToDeletedItems(emailId);
          break;
      }
      console.log(`Post-process action "${action}" completed successfully`);
    } catch (error) {
      console.warn(`Post-process action "${action}" failed:`, (error as Error).message);
    }
  }

  private async markAsRead(emailId: string): Promise<void> {
    await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/messages/${emailId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        isRead: true
      })
    });
  }

  private async moveToFolder(emailId: string, folderName: string): Promise<void> {
    const foldersResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/mailFolders`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const foldersData = await foldersResponse.json();
    let targetFolder = foldersData.value?.find((f: any) => f.displayName === folderName);

    if (!targetFolder) {
      const createFolderResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/mailFolders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ displayName: folderName })
      });
      if (createFolderResponse.ok) {
        targetFolder = await createFolderResponse.json();
      }
    }

    if (targetFolder) {
      await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/messages/${emailId}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destinationId: targetFolder.id })
      });
    }
  }

  private async archive(emailId: string): Promise<void> {
    const foldersResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/mailFolders`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const foldersData = await foldersResponse.json();
    const archiveFolder = foldersData.value?.find((f: any) => f.displayName === 'Archive');

    if (archiveFolder) {
      await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/messages/${emailId}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destinationId: archiveFolder.id })
      });
    }

    await this.markAsRead(emailId);
  }

  private async moveToDeletedItems(emailId: string): Promise<void> {
    const foldersResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/mailFolders`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    const foldersData = await foldersResponse.json();
    const deletedFolder = foldersData.value?.find((f: any) => f.displayName === 'Deleted Items');

    if (deletedFolder) {
      await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.monitored_email}/messages/${emailId}/move`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ destinationId: deletedFolder.id })
      });
    }
  }
}
