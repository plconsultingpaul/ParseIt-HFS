/*
  # Create Workflow Step Logs Table

  ## Overview
  Creates a new table to track individual workflow step executions. This allows for granular logging
  of each step in a workflow, making it easy to see which steps ran, were skipped, or failed.

  ## New Tables
  
  ### `workflow_step_logs`
  Tracks individual step executions within workflow runs.
  
  **Columns:**
  - `id` (uuid, primary key) - Unique identifier for the step log entry
  - `workflow_execution_log_id` (uuid, foreign key) - Reference to parent workflow execution log
  - `workflow_id` (uuid, foreign key) - Reference to the workflow definition (extraction_workflows)
  - `step_id` (uuid, foreign key) - Reference to the workflow step definition
  - `step_name` (text) - Name of the step for quick reference
  - `step_type` (text) - Type of step (e.g., 'extract', 'transform', 'lookup', 'conditional')
  - `step_order` (integer) - Order position of the step in the workflow
  - `status` (text) - Current status: 'running', 'completed', 'failed', 'skipped'
  - `started_at` (timestamptz) - When the step execution started
  - `completed_at` (timestamptz, nullable) - When the step execution completed
  - `duration_ms` (integer, nullable) - Duration of step execution in milliseconds
  - `error_message` (text, nullable) - Error message if step failed
  - `input_data` (jsonb, nullable) - Input context data for the step
  - `output_data` (jsonb, nullable) - Output data produced by the step
  - `created_at` (timestamptz) - Record creation timestamp

  ## Indexes
  
  1. `idx_workflow_step_logs_execution_id` - For quickly fetching all steps for a workflow execution
  2. `idx_workflow_step_logs_status` - For filtering by step status
  3. `idx_workflow_step_logs_workflow_id` - For fetching steps by workflow definition

  ## Security
  
  - Enable RLS on workflow_step_logs table
  - Add public read policy to allow authenticated users to view step logs
  - Add policy for system to insert and update step logs

  ## Notes
  
  - This table works alongside workflow_execution_logs to provide detailed step-by-step tracking
  - The step_order field ensures steps are displayed in execution sequence
  - Duration is calculated and stored when step completes for performance metrics
*/

-- Create workflow_step_logs table
CREATE TABLE IF NOT EXISTS workflow_step_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_log_id uuid NOT NULL REFERENCES workflow_execution_logs(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES extraction_workflows(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  step_type text NOT NULL,
  step_order integer NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  error_message text,
  input_data jsonb,
  output_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_execution_id 
  ON workflow_step_logs(workflow_execution_log_id);

CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_status 
  ON workflow_step_logs(status);

CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_workflow_id 
  ON workflow_step_logs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_step_id 
  ON workflow_step_logs(step_id);

-- Enable RLS
ALTER TABLE workflow_step_logs ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read step logs
CREATE POLICY "Authenticated users can read workflow step logs"
  ON workflow_step_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert step logs
CREATE POLICY "Authenticated users can insert workflow step logs"
  ON workflow_step_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated users to update step logs
CREATE POLICY "Authenticated users can update workflow step logs"
  ON workflow_step_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for public (anon) access to read step logs
CREATE POLICY "Public can read workflow step logs"
  ON workflow_step_logs
  FOR SELECT
  TO anon
  USING (true);

-- Policy for public (anon) to insert step logs
CREATE POLICY "Public can insert workflow step logs"
  ON workflow_step_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy for public (anon) to update step logs
CREATE POLICY "Public can update workflow step logs"
  ON workflow_step_logs
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);