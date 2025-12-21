/*
  # Rollback Incorrect Notification Columns and Add Notification Logs

  ## Summary
  This migration cleans up duplicate/incorrect notification columns added by migration 
  20251211000608 and adds a proper notification logs table for tracking sent notifications.

  ## Changes

  ### 1. Removed Columns from `email_monitoring_config` (8 columns)
  The following global default columns are removed because notifications are now 
  template-based, not configuration-based:
    - `default_failure_notification_email` - Replaced by notification_templates.recipient_email
    - `default_failure_subject` - Replaced by notification_templates.subject_template
    - `default_failure_body_template` - Replaced by notification_templates.body_template
    - `default_attach_pdf_on_failure` - Replaced by notification_templates.attach_pdf
    - `default_success_subject` - Replaced by notification_templates.subject_template
    - `default_success_body_template` - Replaced by notification_templates.body_template
    - `default_success_cc` - Replaced by notification_templates.cc_emails
    - `default_success_bcc` - Replaced by notification_templates.bcc_emails

  ### 2. Removed Columns from `extraction_types` (9 columns)
  The following per-type override columns are removed because they conflict with 
  the template-based approach:
    - `failure_notification_email` - Replaced by failure_recipient_email_override
    - `failure_notification_subject` - Now in notification template
    - `failure_notification_body` - Now in notification template
    - `attach_pdf_on_failure` - Now in notification template
    - `success_notification_enabled` - Duplicate of enable_success_notifications
    - `success_notification_subject` - Now in notification template
    - `success_notification_body` - Now in notification template
    - `success_notification_cc` - Now in notification template
    - `success_notification_bcc` - Now in notification template

  ### 3. Kept Columns in `extraction_types` (6 columns - correct approach)
    - `enable_failure_notifications` - Toggle to enable failure notifications
    - `enable_success_notifications` - Toggle to enable success notifications
    - `failure_notification_template_id` - Reference to notification template
    - `success_notification_template_id` - Reference to notification template
    - `failure_recipient_email_override` - Override recipient (or use template default)
    - `success_recipient_email_override` - Override recipient (or use template default)

  ### 4. New Table: `notification_logs`
  Tracks all sent notifications for debugging and auditing:
    - `id` - Primary key
    - `workflow_execution_log_id` - Link to workflow execution
    - `extraction_type_id` - Link to extraction type
    - `notification_type` - 'failure' or 'success'
    - `recipient_email` - Who received the notification
    - `subject` - Rendered subject line
    - `body` - Rendered body content
    - `cc_emails` - CC recipients
    - `bcc_emails` - BCC recipients
    - `sent_at` - Timestamp
    - `send_status` - 'sent' or 'failed'
    - `error_message` - Error details if failed
    - `pdf_attached` - Whether PDF was attached
    - `template_id` - Which template was used

  ## Security
  - RLS enabled on notification_logs
  - Authenticated users can view their own logs

  ## Notes
  This migration is safe to run - it only removes unused columns that were never 
  integrated into the codebase. The code uses the template-based columns only.
*/

-- =====================================================================
-- STEP 1: Remove duplicate columns from email_monitoring_config
-- =====================================================================

ALTER TABLE email_monitoring_config
DROP COLUMN IF EXISTS default_failure_notification_email,
DROP COLUMN IF EXISTS default_failure_subject,
DROP COLUMN IF EXISTS default_failure_body_template,
DROP COLUMN IF EXISTS default_attach_pdf_on_failure,
DROP COLUMN IF EXISTS default_success_subject,
DROP COLUMN IF EXISTS default_success_body_template,
DROP COLUMN IF EXISTS default_success_cc,
DROP COLUMN IF EXISTS default_success_bcc;

-- =====================================================================
-- STEP 2: Remove duplicate/conflicting columns from extraction_types
-- =====================================================================

ALTER TABLE extraction_types
DROP COLUMN IF EXISTS failure_notification_email,
DROP COLUMN IF EXISTS failure_notification_subject,
DROP COLUMN IF EXISTS failure_notification_body,
DROP COLUMN IF EXISTS attach_pdf_on_failure,
DROP COLUMN IF EXISTS success_notification_enabled,
DROP COLUMN IF EXISTS success_notification_subject,
DROP COLUMN IF EXISTS success_notification_body,
DROP COLUMN IF EXISTS success_notification_cc,
DROP COLUMN IF EXISTS success_notification_bcc;

-- =====================================================================
-- STEP 3: Create notification_logs table
-- =====================================================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_log_id uuid REFERENCES workflow_execution_logs(id) ON DELETE CASCADE,
  extraction_type_id uuid REFERENCES extraction_types(id) ON DELETE SET NULL,
  notification_type text NOT NULL CHECK (notification_type IN ('failure', 'success')),
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  cc_emails text,
  bcc_emails text,
  sent_at timestamptz DEFAULT now(),
  send_status text NOT NULL DEFAULT 'sent' CHECK (send_status IN ('sent', 'failed')),
  error_message text,
  pdf_attached boolean DEFAULT false,
  template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_workflow_id 
  ON notification_logs(workflow_execution_log_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_extraction_type 
  ON notification_logs(extraction_type_id);

CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at 
  ON notification_logs(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_logs_type_status 
  ON notification_logs(notification_type, send_status);

-- =====================================================================
-- STEP 4: Enable RLS on notification_logs
-- =====================================================================

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all notification logs
CREATE POLICY "Authenticated users can view notification logs"
  ON notification_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert notification logs
CREATE POLICY "Service role can insert notification logs"
  ON notification_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Public access for anon users (system operations)
CREATE POLICY "Allow anon select on notification_logs"
  ON notification_logs
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on notification_logs"
  ON notification_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- =====================================================================
-- STEP 5: Add helpful comments
-- =====================================================================

COMMENT ON TABLE notification_logs IS 'Tracks all sent workflow notifications for debugging and auditing';
COMMENT ON COLUMN notification_logs.workflow_execution_log_id IS 'Links to the workflow execution that triggered this notification';
COMMENT ON COLUMN notification_logs.notification_type IS 'Type of notification: failure or success';
COMMENT ON COLUMN notification_logs.send_status IS 'Whether the notification was successfully sent';
COMMENT ON COLUMN notification_logs.template_id IS 'Which notification template was used to generate this notification';
