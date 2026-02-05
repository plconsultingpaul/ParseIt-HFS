/*
  # Fix User Confirmation Step Type in Flow Nodes

  1. Changes
    - Updates the step_type check constraint on `execute_button_flow_nodes` table
    - Adds `user_confirmation` to the allowed step types

  2. Background
    - The initial migration only updated `execute_button_steps` table
    - The flow designer uses `execute_button_flow_nodes` table which has its own constraint
    - This was causing a 400 error when trying to add User Confirmation nodes
*/

-- Drop the existing constraint
ALTER TABLE execute_button_flow_nodes
DROP CONSTRAINT IF EXISTS execute_button_flow_nodes_step_type_check;

-- Add the updated constraint with user_confirmation included
ALTER TABLE execute_button_flow_nodes
ADD CONSTRAINT execute_button_flow_nodes_step_type_check 
CHECK ((step_type IS NULL) OR (step_type = ANY (ARRAY['api_call', 'api_endpoint', 'conditional_check', 'data_transform', 'sftp_upload', 'email_action', 'rename_file', 'branch', 'user_confirmation'])));
