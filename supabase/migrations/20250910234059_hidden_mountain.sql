/*
  # Sync Database Schema with Target Schema

  1. New Tables
    - `email_polling_logs` - Track email polling activity
    - `security_settings` - Store security configuration
    - `extraction_workflows` - Define multi-step workflows
    - `workflow_steps` - Individual workflow step definitions
    - `workflow_execution_logs` - Track workflow execution progress

  2. New Columns
    - `email_monitoring_config.provider` - Email provider type (office365/gmail)
    - `email_monitoring_config.enable_auto_detect` - Enable AI auto-detection
    - `email_monitoring_config.gmail_*` - Gmail configuration fields
    - `extraction_logs.workflow_execution_log_id` - Link to workflow execution
    - `extraction_types.workflow_id` - Link to assigned workflow
    - `extraction_types.auto_detect_instructions` - AI detection instructions
    - `users.preferred_upload_mode` - User's preferred upload mode
    - `processed_emails.pdf_filename` - PDF filename field

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies for public access

  4. Data Updates
    - Remove `gemini_api_key` from `settings_config` (moved to `api_settings`)
*/

-- Add missing columns to email_monitoring_config
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'provider'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN provider text NOT NULL DEFAULT 'office365'::text;
    ALTER TABLE email_monitoring_config ADD CONSTRAINT email_monitoring_config_provider_check CHECK (provider = ANY (ARRAY['office365'::text, 'gmail'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'enable_auto_detect'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN enable_auto_detect boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_client_id'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_client_id text NOT NULL DEFAULT ''::text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_client_secret'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_client_secret text NOT NULL DEFAULT ''::text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_refresh_token'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_refresh_token text NOT NULL DEFAULT ''::text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_monitored_label'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_monitored_label text NOT NULL DEFAULT 'INBOX'::text;
  END IF;
END $$;

-- Create email_polling_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS email_polling_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamp with time zone DEFAULT now(),
  provider text NOT NULL DEFAULT 'office365'::text CHECK (provider = ANY (ARRAY['office365'::text, 'gmail'::text])),
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'failed'::text])),
  emails_found integer DEFAULT 0,
  emails_processed integer DEFAULT 0,
  error_message text,
  execution_time_ms integer,
  created_at timestamp with time zone DEFAULT now()
);

-- Create security_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_upload_mode text DEFAULT 'manual'::text CHECK (default_upload_mode = ANY (ARRAY['manual'::text, 'auto'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create extraction_workflows table if it doesn't exist
CREATE TABLE IF NOT EXISTS extraction_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT ''::text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create workflow_steps table if it doesn't exist
CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL,
  step_order integer NOT NULL,
  step_type text NOT NULL CHECK (step_type = ANY (ARRAY['api_call'::text, 'conditional_check'::text, 'data_transform'::text, 'sftp_upload'::text])),
  step_name text NOT NULL,
  config_json jsonb DEFAULT '{}'::jsonb,
  next_step_on_success_id uuid,
  next_step_on_failure_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES extraction_workflows(id) ON DELETE CASCADE,
  CONSTRAINT workflow_steps_next_step_on_success_id_fkey FOREIGN KEY (next_step_on_success_id) REFERENCES workflow_steps(id) ON DELETE SET NULL,
  CONSTRAINT workflow_steps_next_step_on_failure_id_fkey FOREIGN KEY (next_step_on_failure_id) REFERENCES workflow_steps(id) ON DELETE SET NULL
);

-- Create workflow_execution_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_log_id uuid,
  workflow_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])),
  current_step_id uuid,
  current_step_name text,
  error_message text,
  context_data jsonb DEFAULT '{}'::jsonb,
  started_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT workflow_execution_logs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES extraction_workflows(id) ON DELETE CASCADE,
  CONSTRAINT workflow_execution_logs_current_step_id_fkey FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id) ON DELETE SET NULL
);

-- Add missing columns to extraction_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'workflow_execution_log_id'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN workflow_execution_log_id uuid;
    ALTER TABLE extraction_logs ADD CONSTRAINT extraction_logs_workflow_execution_log_id_fkey 
      FOREIGN KEY (workflow_execution_log_id) REFERENCES workflow_execution_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add missing columns to extraction_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'workflow_id'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN workflow_id uuid;
    ALTER TABLE extraction_types ADD CONSTRAINT extraction_types_workflow_id_fkey 
      FOREIGN KEY (workflow_id) REFERENCES extraction_workflows(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'auto_detect_instructions'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN auto_detect_instructions text;
  END IF;
END $$;

-- Add missing columns to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferred_upload_mode'
  ) THEN
    ALTER TABLE users ADD COLUMN preferred_upload_mode text DEFAULT 'manual'::text;
    ALTER TABLE users ADD CONSTRAINT users_preferred_upload_mode_check 
      CHECK (preferred_upload_mode = ANY (ARRAY['manual'::text, 'auto'::text]));
  END IF;
END $$;

-- Add missing columns to processed_emails
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'processed_emails' AND column_name = 'pdf_filename'
  ) THEN
    ALTER TABLE processed_emails ADD COLUMN pdf_filename text NOT NULL DEFAULT ''::text;
  END IF;
END $$;

-- Remove gemini_api_key from settings_config if it exists (moved to api_settings)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'settings_config' AND column_name = 'gemini_api_key'
  ) THEN
    ALTER TABLE settings_config DROP COLUMN gemini_api_key;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE email_polling_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;

-- Add policies for new tables (allowing public access for now)
CREATE POLICY "Allow public access to email polling logs"
  ON email_polling_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to security settings"
  ON security_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to extraction workflows"
  ON extraction_workflows
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to workflow steps"
  ON workflow_steps
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to workflow execution logs"
  ON workflow_execution_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_polling_logs_timestamp ON email_polling_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_email_polling_logs_provider ON email_polling_logs(provider);
CREATE INDEX IF NOT EXISTS idx_email_polling_logs_status ON email_polling_logs(status);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_step_order ON workflow_steps(workflow_id, step_order);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_workflow_id ON workflow_execution_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_extraction_log_id ON workflow_execution_logs(extraction_log_id);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_status ON workflow_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_started_at ON workflow_execution_logs(started_at DESC);

-- Add foreign key constraint for extraction_logs.workflow_execution_log_id after workflow_execution_logs table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'extraction_logs_workflow_execution_log_id_fkey'
    AND table_name = 'extraction_logs'
  ) THEN
    -- First, ensure the column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'extraction_logs' AND column_name = 'workflow_execution_log_id'
    ) THEN
      ALTER TABLE extraction_logs ADD COLUMN workflow_execution_log_id uuid;
    END IF;
    
    -- Then add the foreign key constraint
    ALTER TABLE extraction_logs ADD CONSTRAINT extraction_logs_workflow_execution_log_id_fkey 
      FOREIGN KEY (workflow_execution_log_id) REFERENCES workflow_execution_logs(id) ON DELETE SET NULL;
  END IF;
END $$;