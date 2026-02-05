/*
  # Add User Confirmation Step Type

  1. Changes
    - Add 'user_confirmation' to the step_type check constraint on execute_button_steps table
    - This allows workflow designers to create steps that pause execution and prompt users with Yes/No questions

  2. Purpose
    - Enables interactive workflow steps that require user confirmation before proceeding
    - Supports variable substitution in prompt messages (e.g., "Client {{clientId}} already exists. Continue?")
    - Allows branching based on user's Yes/No response

  3. Notes
    - This is an additive change that does not affect existing step types
    - Does not impact Extract/Transform workflows which use separate workflow_steps table
*/

-- Drop and recreate the check constraint to add user_confirmation
ALTER TABLE execute_button_steps
DROP CONSTRAINT IF EXISTS execute_button_steps_step_type_check;

ALTER TABLE execute_button_steps
ADD CONSTRAINT execute_button_steps_step_type_check 
CHECK (step_type IN ('api_call', 'api_endpoint', 'conditional_check', 'data_transform', 'sftp_upload', 'email_action', 'rename_file', 'user_confirmation'));
