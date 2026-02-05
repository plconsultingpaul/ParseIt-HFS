/*
  # Add User Response Feature to Workflow Steps

  1. Changes to `workflow_steps` table
    - `user_response_template` (text, nullable) - Template message with variable placeholders
      that admins can configure to show users meaningful feedback for each step

  2. Changes to `workflow_step_logs` table
    - `user_response` (text, nullable) - The resolved/processed message after variable
      substitution, displayed to users during workflow execution

  3. Purpose
    - Allow admins to configure custom user-facing messages for each workflow step
    - Messages can include variable placeholders like {fieldName} that get resolved
      with actual values during execution
    - Example: "Find Client ID - Found Client Id: {orders.0.consignee.clientId}"
*/

-- Add user_response_template to workflow_steps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_steps' AND column_name = 'user_response_template'
  ) THEN
    ALTER TABLE workflow_steps ADD COLUMN user_response_template text;
  END IF;
END $$;

-- Add user_response to workflow_step_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_step_logs' AND column_name = 'user_response'
  ) THEN
    ALTER TABLE workflow_step_logs ADD COLUMN user_response text;
  END IF;
END $$;