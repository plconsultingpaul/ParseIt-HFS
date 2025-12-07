/*
  # Add Step Configuration to Workflow Step Logs

  1. Changes
    - Add `step_config` column to workflow_step_logs table
      - Stores the complete step configuration (URL, headers, method, response data path, etc.)
      - JSONB type for flexible storage of all step parameters
      - Allows logs to show exactly what configuration was used during execution

  2. Purpose
    - Capture full step configuration details for debugging
    - Display configuration values like Response Data Path, URL, Method, Headers in logs
    - Preserve historical configuration even if step definition changes later
*/

-- Add step_config column to workflow_step_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_step_logs' AND column_name = 'step_config'
  ) THEN
    ALTER TABLE workflow_step_logs ADD COLUMN step_config jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;