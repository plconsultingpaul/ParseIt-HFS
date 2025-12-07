/*
  # Add api_endpoint and rename_file step types to workflow_step_logs

  1. Schema Changes
    - Update workflow_step_logs table step_type constraint to include:
      - 'api_endpoint' (new step type for API Spec endpoints)
      - 'rename_file' (existing data uses this instead of rename_pdf)
  
  2. Security
    - No RLS changes needed (existing policies apply)
    
  3. Notes
    - This mirrors the changes made to workflow_steps table in migration 20251201021501
    - Without this constraint, api_endpoint and rename_file steps cannot create step logs
*/

-- Add api_endpoint and rename_file to the step_type check constraint for workflow_step_logs
DO $$
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'workflow_step_logs' 
    AND constraint_name = 'workflow_step_logs_step_type_check'
  ) THEN
    ALTER TABLE workflow_step_logs DROP CONSTRAINT workflow_step_logs_step_type_check;
  END IF;
  
  -- Add the new constraint with api_endpoint and rename_file included
  ALTER TABLE workflow_step_logs ADD CONSTRAINT workflow_step_logs_step_type_check 
    CHECK ((step_type = ANY (ARRAY[
      'api_call'::text, 
      'conditional_check'::text, 
      'data_transform'::text, 
      'sftp_upload'::text, 
      'rename_pdf'::text, 
      'rename_file'::text,
      'email_action'::text, 
      'api_endpoint'::text
    ])));
END $$;
