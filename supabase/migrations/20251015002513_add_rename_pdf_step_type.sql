/*
  # Add rename_pdf to workflow_step_logs step_type constraint
  
  1. Changes
    - Drop the existing CHECK constraint on step_type
    - Add a new CHECK constraint that includes 'rename_pdf'
  
  2. Notes
    - This allows the workflow_step_logs table to accept 'rename_pdf' as a valid step type
    - The rename_pdf step type was missing from the original constraint
*/

-- Drop the old constraint
ALTER TABLE workflow_step_logs DROP CONSTRAINT IF EXISTS workflow_step_logs_step_type_check;

-- Add new constraint with rename_pdf included
ALTER TABLE workflow_step_logs 
  ADD CONSTRAINT workflow_step_logs_step_type_check 
  CHECK (step_type = ANY (ARRAY[
    'api_call'::text, 
    'conditional_check'::text, 
    'data_transform'::text, 
    'sftp_upload'::text, 
    'email_action'::text,
    'rename_pdf'::text
  ]));