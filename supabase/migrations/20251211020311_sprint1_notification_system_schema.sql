/*
  # Sprint 1 & 2: Complete Notification System Database Schema

  1. New Tables
    - `notification_templates` - Stores reusable email notification templates
      - Supports both 'failure' and 'success' notification types
      - Template variable support for dynamic content
      - Global default template capability

  2. Modified Tables
    - `extraction_types` - Add notification configuration columns
    - `workflow_execution_logs` - Track notification sending status
    - `processed_emails` - Track email notification status

  3. Security
    - Enable RLS on notification_templates
    - Public access policies for authenticated operations

  4. Features
    - Template-based notifications with variable substitution
    - Per-extraction-type configuration
    - Global default fallback templates
    - Support for {{response.*}} nested fields
*/

-- Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text NOT NULL CHECK (template_type IN ('failure', 'success')),
  template_name text NOT NULL,
  recipient_email text,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  attach_pdf boolean DEFAULT false,
  cc_emails text,
  bcc_emails text,
  is_global_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_templates
CREATE POLICY "Allow public read access to notification_templates"
  ON notification_templates FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to notification_templates"
  ON notification_templates FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to notification_templates"
  ON notification_templates FOR UPDATE
  TO public
  USING (true);

CREATE POLICY "Allow public delete access to notification_templates"
  ON notification_templates FOR DELETE
  TO public
  USING (true);

-- Add notification columns to extraction_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'failure_notification_template_id'
  ) THEN
    ALTER TABLE extraction_types
    ADD COLUMN failure_notification_template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
    ADD COLUMN success_notification_template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
    ADD COLUMN enable_failure_notifications boolean DEFAULT false,
    ADD COLUMN enable_success_notifications boolean DEFAULT false,
    ADD COLUMN failure_recipient_email_override text,
    ADD COLUMN success_recipient_email_override text;
  END IF;
END $$;

-- Add notification columns to workflow_execution_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_execution_logs' AND column_name = 'sender_email'
  ) THEN
    ALTER TABLE workflow_execution_logs
    ADD COLUMN sender_email text,
    ADD COLUMN failure_notification_sent boolean DEFAULT false,
    ADD COLUMN success_notification_sent boolean DEFAULT false,
    ADD COLUMN notification_sent_at timestamptz;
  END IF;
END $$;

-- Add notification columns to processed_emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processed_emails' AND column_name = 'failure_notification_sent'
  ) THEN
    ALTER TABLE processed_emails
    ADD COLUMN failure_notification_sent boolean DEFAULT false,
    ADD COLUMN success_notification_sent boolean DEFAULT false;
  END IF;
END $$;

-- Insert default failure notification template
INSERT INTO notification_templates (
  template_type,
  template_name,
  recipient_email,
  subject_template,
  body_template,
  attach_pdf,
  is_global_default
) VALUES (
  'failure',
  'Default Failure Notification',
  '{{sender_email}}',
  'Parse-It Processing Failed - {{extraction_type_name}}',
  'Hello,

An error occurred while processing your document "{{pdf_filename}}".

Extraction Type: {{extraction_type_name}}
Error: {{error_message}}
Processing Date: {{timestamp}}

Please review the attached PDF and contact support if needed.

Thank you,
Parse-It Team',
  true,
  true
) ON CONFLICT DO NOTHING;

-- Insert default success notification templates
INSERT INTO notification_templates (
  template_type,
  template_name,
  recipient_email,
  subject_template,
  body_template,
  attach_pdf,
  is_global_default
) VALUES (
  'success',
  'Basic Success Notification',
  '{{sender_email}}',
  'Document Processed Successfully - {{extraction_type_name}}',
  'Hello,

Your document "{{pdf_filename}}" has been successfully processed!

Extraction Type: {{extraction_type_name}}
Processing Date: {{timestamp}}

Thank you for using Parse-It!',
  false,
  true
) ON CONFLICT DO NOTHING;

INSERT INTO notification_templates (
  template_type,
  template_name,
  recipient_email,
  subject_template,
  body_template,
  attach_pdf,
  is_global_default
) VALUES (
  'success',
  'Success with API Response Data',
  '{{sender_email}}',
  'Order Processed: {{response.billNumber}} - {{extraction_type_name}}',
  'Hello,

Your order has been successfully processed!

Document: {{pdf_filename}}
Extraction Type: {{extraction_type_name}}

Order Details:
- Bill Number: {{response.billNumber}}
- Order Number: {{response.orderNumber}}
- Status: Completed

Processing Date: {{timestamp}}

Thank you for using Parse-It!',
  false,
  false
) ON CONFLICT DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE notification_templates IS 'Stores reusable email notification templates for workflow success/failure notifications';
COMMENT ON COLUMN notification_templates.template_type IS 'Type of notification: failure or success';
COMMENT ON COLUMN notification_templates.recipient_email IS 'Recipient email address - can use template variables like {{sender_email}}';
COMMENT ON COLUMN notification_templates.subject_template IS 'Email subject with template variables like {{extraction_type_name}}, {{response.billNumber}}';
COMMENT ON COLUMN notification_templates.body_template IS 'Email body with template variables - supports nested {{response.*}} fields';
COMMENT ON COLUMN notification_templates.attach_pdf IS 'Whether to attach the original PDF to the notification email';
COMMENT ON COLUMN notification_templates.is_global_default IS 'Whether this is the default template when no specific template is selected';

COMMENT ON COLUMN extraction_types.enable_failure_notifications IS 'Enable automatic failure notifications for this extraction type';
COMMENT ON COLUMN extraction_types.enable_success_notifications IS 'Enable automatic success notifications for this extraction type';
COMMENT ON COLUMN extraction_types.failure_notification_template_id IS 'Template to use for failure notifications. NULL = use global default';
COMMENT ON COLUMN extraction_types.success_notification_template_id IS 'Template to use for success notifications. NULL = use global default';
COMMENT ON COLUMN extraction_types.failure_recipient_email_override IS 'Override recipient for failure notifications. NULL = use template default';
COMMENT ON COLUMN extraction_types.success_recipient_email_override IS 'Override recipient for success notifications. NULL = use template default (usually sender)';

COMMENT ON COLUMN workflow_execution_logs.sender_email IS 'Email address of the sender (captured from processed_emails)';
COMMENT ON COLUMN workflow_execution_logs.failure_notification_sent IS 'Whether a failure notification email was sent';
COMMENT ON COLUMN workflow_execution_logs.success_notification_sent IS 'Whether a success notification email was sent';
COMMENT ON COLUMN workflow_execution_logs.notification_sent_at IS 'Timestamp when notification was sent';
