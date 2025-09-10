/*
  # Create workflow management tables

  1. New Tables
    - `extraction_workflows`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `workflow_steps`
      - `id` (uuid, primary key)
      - `workflow_id` (uuid, foreign key to extraction_workflows)
      - `step_order` (integer)
      - `step_type` (text) - 'api_call', 'conditional_check', 'data_transform'
      - `step_name` (text)
      - `config_json` (jsonb) - step configuration
      - `next_step_on_success_id` (uuid, optional foreign key to workflow_steps)
      - `next_step_on_failure_id` (uuid, optional foreign key to workflow_steps)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `workflow_execution_logs`
      - `id` (uuid, primary key)
      - `extraction_log_id` (uuid, foreign key to extraction_logs)
      - `workflow_id` (uuid, foreign key to extraction_workflows)
      - `status` (text) - 'pending', 'running', 'completed', 'failed'
      - `current_step_id` (uuid, optional foreign key to workflow_steps)
      - `current_step_name` (text, optional)
      - `error_message` (text, optional)
      - `context_data` (jsonb, optional)
      - `started_at` (timestamp, default now)
      - `updated_at` (timestamp, default now)
      - `completed_at` (timestamp, optional)

  2. Table Updates
    - Add `workflow_id` to `extraction_types` table
    - Add `workflow_execution_log_id` to `extraction_logs` table

  3. Security
    - Enable RLS on all new tables
    - Add policies for public access (matching existing pattern)
*/

-- Create extraction_workflows table
CREATE TABLE IF NOT EXISTS extraction_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE extraction_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to extraction workflows"
  ON extraction_workflows
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create workflow_steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES extraction_workflows(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  step_type text NOT NULL CHECK (step_type IN ('api_call', 'conditional_check', 'data_transform')),
  step_name text NOT NULL,
  config_json jsonb DEFAULT '{}',
  next_step_on_success_id uuid REFERENCES workflow_steps(id) ON DELETE SET NULL,
  next_step_on_failure_id uuid REFERENCES workflow_steps(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to workflow steps"
  ON workflow_steps
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create workflow_execution_logs table
CREATE TABLE IF NOT EXISTS workflow_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_log_id uuid REFERENCES extraction_logs(id) ON DELETE CASCADE,
  workflow_id uuid NOT NULL REFERENCES extraction_workflows(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  current_step_id uuid REFERENCES workflow_steps(id) ON DELETE SET NULL,
  current_step_name text,
  error_message text,
  context_data jsonb DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to workflow execution logs"
  ON workflow_execution_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add workflow_id to extraction_types table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'workflow_id'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN workflow_id uuid REFERENCES extraction_workflows(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add workflow_execution_log_id to extraction_logs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'workflow_execution_log_id'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN workflow_execution_log_id uuid REFERENCES workflow_execution_logs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON workflow_steps(workflow_id, step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_status ON workflow_execution_logs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_extraction_log ON workflow_execution_logs(extraction_log_id);
CREATE INDEX IF NOT EXISTS idx_extraction_types_workflow_id ON extraction_types(workflow_id);