/*
  # Create Workflow Step Logs Table

  1. New Tables
    - `workflow_step_logs` - Track individual step execution within workflows
      - `id` (uuid, primary key)
      - `workflow_execution_log_id` (uuid, foreign key to workflow_execution_logs)
      - `workflow_id` (uuid, foreign key to extraction_workflows)
      - `step_id` (uuid, foreign key to workflow_steps)
      - `step_name` (text) - Name of the step for display
      - `step_type` (text) - Type of step (api_call, conditional_check, etc.)
      - `step_order` (integer) - Order of the step in the workflow
      - `status` (text) - Status of the step (running, completed, failed, skipped)
      - `started_at` (timestamptz) - When the step started
      - `completed_at` (timestamptz) - When the step completed
      - `duration_ms` (integer) - Duration in milliseconds
      - `error_message` (text) - Error message if step failed
      - `input_data` (jsonb) - Input data for the step
      - `output_data` (jsonb) - Output data from the step
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on workflow_step_logs table
    - Add policy for public access (to match existing workflow tables)

  3. Indexes
    - Index on workflow_execution_log_id for efficient querying
    - Index on workflow_id for filtering
    - Index on step_order for ordering
*/

-- Create workflow_step_logs table
CREATE TABLE IF NOT EXISTS workflow_step_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_log_id uuid NOT NULL,
  workflow_id uuid NOT NULL,
  step_id uuid NOT NULL,
  step_name text NOT NULL,
  step_type text NOT NULL CHECK (step_type = ANY (ARRAY['api_call'::text, 'conditional_check'::text, 'data_transform'::text, 'sftp_upload'::text, 'email_action'::text])),
  step_order integer NOT NULL,
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'skipped'::text])),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  duration_ms integer,
  error_message text,
  input_data jsonb DEFAULT '{}'::jsonb,
  output_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workflow_step_logs_workflow_execution_log_id_fkey 
    FOREIGN KEY (workflow_execution_log_id) REFERENCES workflow_execution_logs(id) ON DELETE CASCADE,
  CONSTRAINT workflow_step_logs_workflow_id_fkey 
    FOREIGN KEY (workflow_id) REFERENCES extraction_workflows(id) ON DELETE CASCADE,
  CONSTRAINT workflow_step_logs_step_id_fkey 
    FOREIGN KEY (step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE workflow_step_logs ENABLE ROW LEVEL SECURITY;

-- Add policy for public access (matching other workflow tables)
CREATE POLICY "Allow public access to workflow step logs"
  ON workflow_step_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_execution_log_id 
  ON workflow_step_logs(workflow_execution_log_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_workflow_id 
  ON workflow_step_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_step_order 
  ON workflow_step_logs(workflow_execution_log_id, step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_status 
  ON workflow_step_logs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_created_at 
  ON workflow_step_logs(created_at DESC);