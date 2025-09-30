/*
  # Add email_action step type to workflow_steps

  1. Schema Changes
    - Update workflow_steps table step_type constraint to include 'email_action'
  
  2. Security
    - No RLS changes needed (existing policies apply)
*/

-- Add email_action to the step_type check constraint
DO $$
BEGIN
  -- Drop the existing constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'workflow_steps' 
    AND constraint_name = 'workflow_steps_step_type_check'
  ) THEN
    ALTER TABLE workflow_steps DROP CONSTRAINT workflow_steps_step_type_check;
  END IF;
  
  -- Add the new constraint with email_action included
  ALTER TABLE workflow_steps ADD CONSTRAINT workflow_steps_step_type_check 
    CHECK ((step_type = ANY (ARRAY['api_call'::text, 'conditional_check'::text, 'data_transform'::text, 'sftp_upload'::text, 'rename_pdf'::text, 'email_action'::text])));
END $$;