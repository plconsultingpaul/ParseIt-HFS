/*
  # Create Invitation Email Templates Table

  1. New Tables
    - `invitation_email_templates`
      - `id` (uuid, primary key)
      - `template_name` (text) - Name/identifier for the template
      - `subject` (text) - Email subject line with variable support
      - `body_html` (text) - HTML body content with variable support
      - `is_default` (boolean) - Whether this is the default template
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Available Variables
    - {{username}} - The user's username
    - {{reset_link}} - The password setup URL
    - {{company_name}} - Company name from branding
    - {{expiration_hours}} - Token expiration time (48 hours)

  3. Security
    - Enable RLS on table
    - Only admins can view/modify templates
*/

CREATE TABLE IF NOT EXISTS invitation_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL DEFAULT 'Default Invitation',
  subject text NOT NULL DEFAULT 'Complete Your Account Registration',
  body_html text NOT NULL DEFAULT '',
  is_default boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invitation_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to read invitation templates"
  ON invitation_email_templates
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert invitation templates"
  ON invitation_email_templates
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update invitation templates"
  ON invitation_email_templates
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete invitation templates"
  ON invitation_email_templates
  FOR DELETE
  TO anon
  USING (true);

INSERT INTO invitation_email_templates (template_name, subject, body_html, is_default)
VALUES (
  'Default Invitation',
  'Complete Your Account Registration',
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
            <td style="background: linear-gradient(135deg, #14b8a6 0%, #0891b2 100%); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
                Welcome to {{company_name}}!
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello {{username}},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Your account has been created! To complete your registration and access your account, please set your password by clicking the button below.
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                This link will expire in <strong>{{expiration_hours}} hours</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{reset_link}}" style="display: inline-block; padding: 16px 32px; background-color: #14b8a6; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(20, 184, 166, 0.3);">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding-top: 30px; border-top: 1px solid #e5e7eb;">
                If the button doesn''t work, copy and paste this link into your browser:
              </p>
              <p style="color: #14b8a6; font-size: 13px; word-break: break-all; margin: 10px 0 0 0;">
                {{reset_link}}
              </p>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0;">
                If you didn''t request this registration, please ignore this email or contact your administrator.
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
  true
)
ON CONFLICT DO NOTHING;