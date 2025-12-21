/*
  # Add Template Type to Invitation Email Templates

  1. Changes
    - Add `template_type` column to distinguish between admin and client templates
    - Values: 'admin' (for admin users) or 'client' (for client portal users)
    - Update existing template to be 'client' type
    - Create new 'admin' type template

  2. Notes
    - Each type can have its own default template
    - Backward compatible - existing template becomes client type
*/

ALTER TABLE invitation_email_templates 
ADD COLUMN IF NOT EXISTS template_type text NOT NULL DEFAULT 'client';

UPDATE invitation_email_templates 
SET template_type = 'client' 
WHERE template_type IS NULL OR template_type = '';

INSERT INTO invitation_email_templates (template_name, subject, body_html, is_default, template_type)
SELECT 
  'Admin Invitation',
  'Complete Your Administrator Account Setup',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your Registration</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                Welcome to {{company_name}}
              </h1>
              <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">
                Administrator Portal Access
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello {{username}},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your administrator account has been created. To complete your setup and access the administration portal, please set your password by clicking the button below.
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                This link will expire in <strong>{{expiration_hours}} hours</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{reset_link}}" style="display: inline-block; padding: 16px 32px; background-color: #1e3a5f; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(30, 58, 95, 0.3);">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                If the button doesn''t work, copy and paste this link into your browser:
              </p>
              <p style="color: #1e3a5f; font-size: 13px; word-break: break-all; margin: 10px 0 0 0;">
                {{reset_link}}
              </p>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
                If you didn''t request this registration, please ignore this email or contact your system administrator.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                {{company_name}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  true,
  'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM invitation_email_templates WHERE template_type = 'admin'
);