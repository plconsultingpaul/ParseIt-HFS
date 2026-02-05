/*
  # Add Email Document Feature

  1. Changes to track_trace_document_configs
    - `email_enabled` (boolean) - Toggle to enable/disable email button per document config
    - `email_subject` (text) - Subject line for the document email
    - `email_template` (text) - HTML template for the email body

  2. Notes
    - email_enabled defaults to false (opt-in feature)
    - email_template stores HTML that can include variables like {{document_name}}, {{recipient_name}}
*/

-- Add email_enabled column to track_trace_document_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'track_trace_document_configs' AND column_name = 'email_enabled'
  ) THEN
    ALTER TABLE track_trace_document_configs ADD COLUMN email_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add email_subject column to track_trace_document_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'track_trace_document_configs' AND column_name = 'email_subject'
  ) THEN
    ALTER TABLE track_trace_document_configs ADD COLUMN email_subject text DEFAULT 'Document: {{document_name}}';
  END IF;
END $$;

-- Add email_template column to track_trace_document_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'track_trace_document_configs' AND column_name = 'email_template'
  ) THEN
    ALTER TABLE track_trace_document_configs ADD COLUMN email_template text DEFAULT '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
                {{document_name}}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Please find the attached document: <strong>{{document_name}}</strong>
              </p>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                This document was shared with you from the shipment tracking system.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                {{company_name}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>';
  END IF;
END $$;