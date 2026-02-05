/*
  # Add Exit Step Type to Execute Button Flows

  1. Changes
    - Add 'exit' to the step_type constraint on execute_button_flow_nodes table
    - This allows flow designers to add terminal exit nodes that display custom messages
    
  2. Purpose
    - Exit steps allow users to see a custom message when a flow ends
    - Optionally provides a "Restart" button to run the flow again
*/

ALTER TABLE execute_button_flow_nodes 
DROP CONSTRAINT IF EXISTS execute_button_flow_nodes_step_type_check;

ALTER TABLE execute_button_flow_nodes 
ADD CONSTRAINT execute_button_flow_nodes_step_type_check 
CHECK (step_type IS NULL OR step_type IN (
  'api_call', 'api_endpoint', 'conditional_check', 'data_transform', 
  'sftp_upload', 'email_action', 'rename_file', 'branch', 
  'user_confirmation', 'exit'
));
