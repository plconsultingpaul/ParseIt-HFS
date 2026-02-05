/*
  # Create Execute Button Workflow Steps

  1. New Tables
    - `execute_button_steps`
      - `id` (uuid, primary key)
      - `button_id` (uuid, foreign key to execute_buttons)
      - `step_order` (integer) - execution order
      - `step_type` (text) - api_call, api_endpoint, conditional_check, data_transform, sftp_upload, email_action, rename_file
      - `step_name` (text) - display name for the step
      - `config_json` (jsonb) - step configuration (same format as workflow_steps)
      - `next_step_on_success_id` (uuid, self-reference) - optional branching
      - `next_step_on_failure_id` (uuid, self-reference) - optional branching
      - `escape_single_quotes_in_body` (boolean) - for API calls
      - `is_enabled` (boolean) - allows disabling steps without deletion
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on the table
    - Add policy for public access (matching existing pattern)

  3. Indexes
    - Index on button_id for fast lookups
    - Index on step_order for ordering
*/

-- Create execute_button_steps table
CREATE TABLE IF NOT EXISTS execute_button_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  button_id uuid NOT NULL REFERENCES execute_buttons(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 100,
  step_type text NOT NULL CHECK (step_type IN ('api_call', 'api_endpoint', 'conditional_check', 'data_transform', 'sftp_upload', 'email_action', 'rename_file')),
  step_name text NOT NULL,
  config_json jsonb DEFAULT '{}',
  next_step_on_success_id uuid REFERENCES execute_button_steps(id) ON DELETE SET NULL,
  next_step_on_failure_id uuid REFERENCES execute_button_steps(id) ON DELETE SET NULL,
  escape_single_quotes_in_body boolean DEFAULT false,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE execute_button_steps ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (matching existing pattern for execute buttons)
CREATE POLICY "Allow public access to execute button steps"
  ON execute_button_steps
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_execute_button_steps_button_id ON execute_button_steps(button_id);
CREATE INDEX IF NOT EXISTS idx_execute_button_steps_order ON execute_button_steps(button_id, step_order);
CREATE INDEX IF NOT EXISTS idx_execute_button_steps_type ON execute_button_steps(step_type);
