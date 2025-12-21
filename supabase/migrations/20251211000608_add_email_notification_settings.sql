/*
  # Add Email Notification Settings

  1. New Columns in `email_monitoring_config` (Global Defaults)
    - `default_failure_notification_email` - Default recipient for failure notifications
    - `default_failure_subject` - Default subject line for failure emails
    - `default_failure_body_template` - Default body template for failure emails
    - `default_attach_pdf_on_failure` - Whether to attach PDF on failure by default
    - `default_success_subject` - Default subject line for success emails
    - `default_success_body_template` - Default body template for success emails
    - `default_success_cc` - Default CC recipients for success emails
    - `default_success_bcc` - Default BCC recipients for success emails

  2. New Columns in `extraction_types` (Per-Type Overrides)
    - `failure_notification_email` - Override recipient for failure notifications (NULL = use global)
    - `failure_notification_subject` - Override subject for failure emails (NULL = use global)
    - `failure_notification_body` - Override body template for failure emails (NULL = use global)
    - `attach_pdf_on_failure` - Override PDF attachment setting (NULL = use global)
    - `success_notification_enabled` - Enable success notifications for this type
    - `success_notification_subject` - Override subject for success emails (NULL = use global)
    - `success_notification_body` - Override body template for success emails (NULL = use global)
    - `success_notification_cc` - CC recipients for success emails (NULL = use global)
    - `success_notification_bcc` - BCC recipients for success emails (NULL = use global)

  3. Available Template Variables
    - All emails: {{extraction_type_name}}, {{pdf_filename}}, {{timestamp}}, {{sender_email}}
    - Failure emails: {{error_message}}
    - Success emails: {{response.fieldName}} (any field from API response)
*/

-- Add global default notification settings to email_monitoring_config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'default_failure_notification_email'
  ) THEN
    ALTER TABLE email_monitoring_config
    ADD COLUMN default_failure_notification_email text,
    ADD COLUMN default_failure_subject text DEFAULT 'Parse-It Extraction Failed',
    ADD COLUMN default_failure_body_template text DEFAULT 'Extraction failed for {{pdf_filename}}: {{error_message}}

Extraction Type: {{extraction_type_name}}
Sender: {{sender_email}}
Timestamp: {{timestamp}}

Please review the attached PDF and contact support if needed.',
    ADD COLUMN default_attach_pdf_on_failure boolean DEFAULT true,
    ADD COLUMN default_success_subject text DEFAULT 'Parse-It Processing Complete',
    ADD COLUMN default_success_body_template text DEFAULT 'Your document {{pdf_filename}} has been processed successfully.

Extraction Type: {{extraction_type_name}}
Timestamp: {{timestamp}}

Thank you for using Parse-It!',
    ADD COLUMN default_success_cc text,
    ADD COLUMN default_success_bcc text;
  END IF;
END $$;

-- Add per-extraction-type notification overrides
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'failure_notification_email'
  ) THEN
    ALTER TABLE extraction_types
    ADD COLUMN failure_notification_email text,
    ADD COLUMN failure_notification_subject text,
    ADD COLUMN failure_notification_body text,
    ADD COLUMN attach_pdf_on_failure boolean,
    ADD COLUMN success_notification_enabled boolean DEFAULT false,
    ADD COLUMN success_notification_subject text,
    ADD COLUMN success_notification_body text,
    ADD COLUMN success_notification_cc text,
    ADD COLUMN success_notification_bcc text;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN email_monitoring_config.default_failure_notification_email IS 'Default recipient email for extraction failure notifications';
COMMENT ON COLUMN email_monitoring_config.default_failure_body_template IS 'Supports: {{extraction_type_name}}, {{pdf_filename}}, {{timestamp}}, {{sender_email}}, {{error_message}}';
COMMENT ON COLUMN email_monitoring_config.default_success_body_template IS 'Supports: {{extraction_type_name}}, {{pdf_filename}}, {{timestamp}}, {{sender_email}}, {{response.fieldName}}';

COMMENT ON COLUMN extraction_types.failure_notification_email IS 'Override recipient for failure notifications. NULL = use global default';
COMMENT ON COLUMN extraction_types.success_notification_enabled IS 'Enable success notifications for this extraction type';
COMMENT ON COLUMN extraction_types.success_notification_cc IS 'CC recipients for success emails (comma-separated). NULL = use global default';
COMMENT ON COLUMN extraction_types.success_notification_bcc IS 'BCC recipients for success emails (comma-separated). NULL = use global default';