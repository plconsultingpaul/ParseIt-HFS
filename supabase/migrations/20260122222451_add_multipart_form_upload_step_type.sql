/*
  # Add Multipart Form Upload Step Type

  This migration adds a new workflow step type for uploading files via
  multipart/form-data HTTP requests. This is separate from the existing
  api_endpoint and api_call steps to avoid breaking existing functionality.

  1. Changes
    - Updates workflow_steps step_type constraint to include 'multipart_form_upload'
    - Updates workflow_step_logs step_type constraint to include 'multipart_form_upload'
    - Updates execute_button_steps step_type constraint (if exists)
    - Updates execute_button_flow_nodes step_type constraint (if exists)

  2. Purpose
    - Enable file uploads via multipart/form-data format
    - Support APIs that require form-data with file attachments
    - Keep separate from JSON-based API calls

  3. Use Case
    - Uploading PDFs to document management systems
    - Sending files with JSON metadata in same request
*/

-- Update workflow_steps step_type constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workflow_steps_step_type_check'
    AND table_name = 'workflow_steps'
  ) THEN
    ALTER TABLE workflow_steps DROP CONSTRAINT workflow_steps_step_type_check;
  END IF;
END $$;

ALTER TABLE workflow_steps ADD CONSTRAINT workflow_steps_step_type_check
CHECK (step_type = ANY (ARRAY[
  'api_call'::text,
  'api_endpoint'::text,
  'conditional_check'::text,
  'data_transform'::text,
  'sftp_upload'::text,
  'email_action'::text,
  'rename_file'::text,
  'multipart_form_upload'::text
]));

-- Update workflow_step_logs step_type constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workflow_step_logs_step_type_check'
    AND table_name = 'workflow_step_logs'
  ) THEN
    ALTER TABLE workflow_step_logs DROP CONSTRAINT workflow_step_logs_step_type_check;
  END IF;
END $$;

ALTER TABLE workflow_step_logs ADD CONSTRAINT workflow_step_logs_step_type_check
CHECK (step_type = ANY (ARRAY[
  'api_call'::text,
  'api_endpoint'::text,
  'conditional_check'::text,
  'data_transform'::text,
  'sftp_upload'::text,
  'email_action'::text,
  'rename_file'::text,
  'multipart_form_upload'::text
]));

-- Update execute_button_steps step_type constraint if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'execute_button_steps') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'execute_button_steps_step_type_check'
      AND table_name = 'execute_button_steps'
    ) THEN
      ALTER TABLE execute_button_steps DROP CONSTRAINT execute_button_steps_step_type_check;
    END IF;
    
    ALTER TABLE execute_button_steps ADD CONSTRAINT execute_button_steps_step_type_check
    CHECK (step_type IN (
      'api_call', 'api_endpoint', 'conditional_check', 'data_transform',
      'sftp_upload', 'email_action', 'rename_file', 'user_confirmation',
      'multipart_form_upload'
    ));
  END IF;
END $$;

-- Update execute_button_flow_nodes step_type constraint if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'execute_button_flow_nodes') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'execute_button_flow_nodes_step_type_check'
      AND table_name = 'execute_button_flow_nodes'
    ) THEN
      ALTER TABLE execute_button_flow_nodes DROP CONSTRAINT execute_button_flow_nodes_step_type_check;
    END IF;
    
    ALTER TABLE execute_button_flow_nodes ADD CONSTRAINT execute_button_flow_nodes_step_type_check
    CHECK ((step_type IS NULL) OR (step_type = ANY (ARRAY[
      'api_call', 'api_endpoint', 'conditional_check', 'data_transform',
      'sftp_upload', 'email_action', 'rename_file', 'branch',
      'user_confirmation', 'exit', 'ai_lookup', 'google_places_lookup',
      'multipart_form_upload'
    ])));
  END IF;
END $$;
