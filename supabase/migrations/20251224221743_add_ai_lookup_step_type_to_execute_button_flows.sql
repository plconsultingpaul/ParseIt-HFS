/*
  # Add AI Lookup Step Type to Execute Button Flows

  1. Changes
    - Add 'ai_lookup' to the step_type check constraint on execute_button_flow_nodes table
    - This enables a new step type that:
      - Sends a prompt to AI (Gemini) with variable substitution
      - Defines response data mappings to extract structured data
      - Stores results in execute.ai.* namespace for use in subsequent steps

  2. Configuration Structure (config_json)
    - prompt: Instructions for AI with {{variable}} support
    - responseDataMappings: Array of { fieldName, aiInstruction } objects
    - Results stored in contextData.execute.ai[fieldName]

  3. Use Case
    - User fills form with name/city
    - AI Lookup searches for business information
    - User confirms results via User Confirmation step
    - Next form group can use {{execute.ai.name}}, {{execute.ai.address}}, etc.
*/

-- Drop and recreate the check constraint to include ai_lookup
ALTER TABLE execute_button_flow_nodes 
DROP CONSTRAINT IF EXISTS execute_button_flow_nodes_step_type_check;

ALTER TABLE execute_button_flow_nodes
ADD CONSTRAINT execute_button_flow_nodes_step_type_check 
CHECK (step_type IS NULL OR step_type IN (
  'api_call', 
  'api_endpoint', 
  'conditional_check', 
  'data_transform', 
  'sftp_upload', 
  'email_action', 
  'rename_file', 
  'branch', 
  'user_confirmation', 
  'exit',
  'ai_lookup'
));