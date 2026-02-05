/*
  # Add Missing Foreign Key: workflow_execution_logs -> extraction_logs

  1. Changes
    - Adds foreign key constraint from `workflow_execution_logs.extraction_log_id` to `extraction_logs.id`
    - This constraint was defined in the original migration but was not applied to the database

  2. Why This Is Needed
    - PostgREST requires explicit foreign key constraints to perform joins
    - The Workflow Execution Logs page fails to load because the join query cannot resolve the relationship
*/

ALTER TABLE workflow_execution_logs 
ADD CONSTRAINT workflow_execution_logs_extraction_log_id_fkey 
FOREIGN KEY (extraction_log_id) 
REFERENCES extraction_logs(id) 
ON DELETE CASCADE;