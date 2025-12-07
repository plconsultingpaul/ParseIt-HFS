/*
  # Add Timeout Handling to Workflow Steps

  1. Schema Changes
    - Add `max_execution_time_ms` column to workflow_steps table
      - Default 5 minutes (300000ms) for most steps
      - Allows configuration per step type
    - Add `timed_out` status option to workflow_step_logs
      - Allows distinguishing between failed and timed out steps
    - Add `last_heartbeat` column to workflow_step_logs
      - Track active execution to detect hanging steps

  2. Functions
    - Create `cleanup_stuck_workflow_steps()` function
      - Automatically marks steps stuck in 'running' state as 'timed_out'
      - Runs based on max_execution_time_ms threshold
      - Updates workflow_execution_logs accordingly

  3. Indexes
    - Add index on status and started_at for efficient stuck step detection

  4. Security
    - Maintain existing RLS policies
*/

-- Add max_execution_time_ms to workflow_steps (default 5 minutes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_steps' AND column_name = 'max_execution_time_ms'
  ) THEN
    ALTER TABLE workflow_steps
    ADD COLUMN max_execution_time_ms integer DEFAULT 300000;

    COMMENT ON COLUMN workflow_steps.max_execution_time_ms IS 'Maximum execution time in milliseconds before step is considered stuck (default 5 minutes)';
  END IF;
END $$;

-- Add last_heartbeat to workflow_step_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_step_logs' AND column_name = 'last_heartbeat'
  ) THEN
    ALTER TABLE workflow_step_logs
    ADD COLUMN last_heartbeat timestamp with time zone DEFAULT now();

    COMMENT ON COLUMN workflow_step_logs.last_heartbeat IS 'Last time step execution was confirmed active';
  END IF;
END $$;

-- Update status check constraint to include 'timed_out'
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE workflow_step_logs DROP CONSTRAINT IF EXISTS workflow_step_logs_status_check;

  -- Add new constraint with 'timed_out' status
  ALTER TABLE workflow_step_logs
  ADD CONSTRAINT workflow_step_logs_status_check
  CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text, 'skipped'::text, 'timed_out'::text]));
END $$;

-- Create index for efficient stuck step detection
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_running_steps
  ON workflow_step_logs(status, started_at)
  WHERE status = 'running';

-- Create function to cleanup stuck workflow steps
CREATE OR REPLACE FUNCTION cleanup_stuck_workflow_steps()
RETURNS TABLE (
  cleaned_step_id uuid,
  step_name text,
  workflow_id uuid,
  stuck_duration_ms bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stuck_step RECORD;
  execution_time_ms bigint;
  max_time_ms integer;
BEGIN
  -- Find all steps stuck in running state
  FOR stuck_step IN
    SELECT
      wsl.id,
      wsl.step_name,
      wsl.workflow_id,
      wsl.workflow_execution_log_id,
      wsl.step_id,
      wsl.started_at,
      COALESCE(ws.max_execution_time_ms, 300000) as max_execution_time
    FROM workflow_step_logs wsl
    LEFT JOIN workflow_steps ws ON ws.id = wsl.step_id
    WHERE wsl.status = 'running'
      AND wsl.started_at < (now() - (COALESCE(ws.max_execution_time_ms, 300000) || ' milliseconds')::interval)
  LOOP
    -- Calculate how long the step has been running
    execution_time_ms := EXTRACT(EPOCH FROM (now() - stuck_step.started_at)) * 1000;

    -- Update the stuck step to timed_out status
    UPDATE workflow_step_logs
    SET
      status = 'timed_out',
      completed_at = now(),
      duration_ms = execution_time_ms::integer,
      error_message = 'Step execution timed out after ' || execution_time_ms || 'ms (max: ' || stuck_step.max_execution_time || 'ms)'
    WHERE id = stuck_step.id;

    -- Update workflow execution log if this was blocking the workflow
    UPDATE workflow_execution_logs
    SET
      status = 'failed',
      error_message = 'Workflow failed: Step "' || stuck_step.step_name || '" timed out',
      completed_at = now()
    WHERE id = stuck_step.workflow_execution_log_id
      AND status = 'running';

    -- Return the cleaned step info
    cleaned_step_id := stuck_step.id;
    step_name := stuck_step.step_name;
    workflow_id := stuck_step.workflow_id;
    stuck_duration_ms := execution_time_ms;

    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

COMMENT ON FUNCTION cleanup_stuck_workflow_steps() IS 'Identifies and marks workflow steps stuck in running state as timed_out';

-- Create a view to easily monitor stuck steps
CREATE OR REPLACE VIEW stuck_workflow_steps AS
SELECT
  wsl.id,
  wsl.step_name,
  wsl.workflow_id,
  w.name as workflow_name,
  wsl.step_type,
  wsl.started_at,
  EXTRACT(EPOCH FROM (now() - wsl.started_at)) * 1000 as running_duration_ms,
  COALESCE(ws.max_execution_time_ms, 300000) as max_execution_time_ms,
  wsl.workflow_execution_log_id
FROM workflow_step_logs wsl
LEFT JOIN workflow_steps ws ON ws.id = wsl.step_id
LEFT JOIN extraction_workflows w ON w.id = wsl.workflow_id
WHERE wsl.status = 'running'
  AND wsl.started_at < (now() - (COALESCE(ws.max_execution_time_ms, 300000) || ' milliseconds')::interval)
ORDER BY wsl.started_at ASC;

COMMENT ON VIEW stuck_workflow_steps IS 'Shows workflow steps that have been running longer than their max execution time';
