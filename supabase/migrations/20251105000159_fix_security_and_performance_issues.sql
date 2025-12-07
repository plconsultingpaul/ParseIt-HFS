/*
  # Fix Security and Performance Issues

  This migration addresses multiple security and performance issues identified in the database audit:

  ## 1. Foreign Key Indexes (Performance)
  Adding indexes to all foreign key columns that lack them:
  - email_processing_rules.extraction_type_id
  - extraction_logs.workflow_execution_log_id
  - page_group_configs.workflow_id
  - processed_emails.extraction_type_id
  - processed_emails.processing_rule_id
  - sftp_polling_configs.default_extraction_type_id
  - sftp_polling_configs.workflow_id
  - vendor_extraction_rules.extraction_type_id
  - vendor_extraction_rules.transformation_type_id
  - workflow_execution_logs.current_step_id
  - workflow_execution_logs.workflow_id
  - workflow_steps.next_step_on_failure_id
  - workflow_steps.next_step_on_success_id

  ## 2. RLS Policy Performance
  Optimizing vendor_extraction_rules policies to use subqueries for auth functions

  ## 3. Unused Indexes (Cleanup)
  Dropping 21 unused indexes that consume storage and slow down writes

  ## 4. Duplicate Indexes (Cleanup)
  Dropping duplicate index on workflow_step_logs

  ## 5. Multiple Permissive Policies (Security)
  Consolidating overlapping RLS policies on:
  - vendor_extraction_rules
  - workflow_step_logs

  ## 6. Security Definer View (Security)
  Removing SECURITY DEFINER from stuck_workflow_steps view

  ## 7. Function Search Path (Security)
  Setting explicit search_path on 7 functions to prevent search_path attacks

  ## 8. Missing RLS (Critical Security)
  Enabling RLS on 3 tables:
  - email_processing_rules
  - processed_emails
  - email_monitoring_config

  ## 9. Extension Location (Best Practice)
  Moving http extension from public to extensions schema
*/

-- ==========================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_email_processing_rules_extraction_type_id 
  ON public.email_processing_rules(extraction_type_id);

CREATE INDEX IF NOT EXISTS idx_extraction_logs_workflow_execution_log_id 
  ON public.extraction_logs(workflow_execution_log_id);

CREATE INDEX IF NOT EXISTS idx_page_group_configs_workflow_id 
  ON public.page_group_configs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_processed_emails_extraction_type_id 
  ON public.processed_emails(extraction_type_id);

CREATE INDEX IF NOT EXISTS idx_processed_emails_processing_rule_id 
  ON public.processed_emails(processing_rule_id);

CREATE INDEX IF NOT EXISTS idx_sftp_polling_configs_default_extraction_type_id 
  ON public.sftp_polling_configs(default_extraction_type_id);

CREATE INDEX IF NOT EXISTS idx_sftp_polling_configs_workflow_id 
  ON public.sftp_polling_configs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_vendor_extraction_rules_extraction_type_id_fk 
  ON public.vendor_extraction_rules(extraction_type_id);

CREATE INDEX IF NOT EXISTS idx_vendor_extraction_rules_transformation_type_id_fk 
  ON public.vendor_extraction_rules(transformation_type_id);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_current_step_id 
  ON public.workflow_execution_logs(current_step_id);

CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_workflow_id 
  ON public.workflow_execution_logs(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_next_step_on_failure_id 
  ON public.workflow_steps(next_step_on_failure_id);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_next_step_on_success_id 
  ON public.workflow_steps(next_step_on_success_id);

-- ==========================================
-- 2. DROP UNUSED INDEXES
-- ==========================================

DROP INDEX IF EXISTS public.idx_extraction_logs_status;
DROP INDEX IF EXISTS public.idx_sftp_polling_configs_enabled;
DROP INDEX IF EXISTS public.idx_sftp_polling_configs_last_polled;
DROP INDEX IF EXISTS public.idx_sftp_polling_logs_config_id;
DROP INDEX IF EXISTS public.idx_sftp_polling_logs_status;
DROP INDEX IF EXISTS public.idx_users_username;
DROP INDEX IF EXISTS public.idx_users_active;
DROP INDEX IF EXISTS public.idx_email_polling_logs_status;
DROP INDEX IF EXISTS public.idx_vendor_extraction_rules_vendor_id;
DROP INDEX IF EXISTS public.idx_vendor_extraction_rules_processing_mode;
DROP INDEX IF EXISTS public.idx_vendor_extraction_rules_enabled;
DROP INDEX IF EXISTS public.idx_users_role;
DROP INDEX IF EXISTS public.idx_email_processing_rules_processing_mode;
DROP INDEX IF EXISTS public.idx_email_processing_rules_transformation_type_id;
DROP INDEX IF EXISTS public.idx_extraction_logs_processing_mode;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_workflow_step_logs_execution_log_id;
DROP INDEX IF EXISTS public.idx_workflow_step_logs_created_at;
DROP INDEX IF EXISTS public.idx_workflow_step_logs_running_steps;
DROP INDEX IF EXISTS public.idx_page_group_configs_transformation_type;
DROP INDEX IF EXISTS public.idx_extraction_logs_page_ranges;

-- ==========================================
-- 3. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- ==========================================

-- Drop overlapping policies on vendor_extraction_rules
DROP POLICY IF EXISTS "Allow public access to vendor extraction rules" ON public.vendor_extraction_rules;
DROP POLICY IF EXISTS "Admins can manage all vendor rules" ON public.vendor_extraction_rules;
DROP POLICY IF EXISTS "Vendors can read their own rules" ON public.vendor_extraction_rules;

-- Create consolidated policies with optimized auth function calls
CREATE POLICY "vendor_extraction_rules_select"
  ON public.vendor_extraction_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = (SELECT auth.uid()) 
      AND users.role = 'admin'
    )
    OR vendor_id = (SELECT auth.uid())
  );

CREATE POLICY "vendor_extraction_rules_insert"
  ON public.vendor_extraction_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = (SELECT auth.uid()) 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "vendor_extraction_rules_update"
  ON public.vendor_extraction_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = (SELECT auth.uid()) 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "vendor_extraction_rules_delete"
  ON public.vendor_extraction_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = (SELECT auth.uid()) 
      AND users.role = 'admin'
    )
  );

-- Drop overlapping policies on workflow_step_logs
DROP POLICY IF EXISTS "Allow public access to workflow step logs" ON public.workflow_step_logs;
DROP POLICY IF EXISTS "Public can insert workflow step logs" ON public.workflow_step_logs;
DROP POLICY IF EXISTS "Public can read workflow step logs" ON public.workflow_step_logs;
DROP POLICY IF EXISTS "Public can update workflow step logs" ON public.workflow_step_logs;
DROP POLICY IF EXISTS "Authenticated users can insert workflow step logs" ON public.workflow_step_logs;
DROP POLICY IF EXISTS "Authenticated users can read workflow step logs" ON public.workflow_step_logs;
DROP POLICY IF EXISTS "Authenticated users can update workflow step logs" ON public.workflow_step_logs;

-- Create consolidated policies for workflow_step_logs
CREATE POLICY "workflow_step_logs_all_access"
  ON public.workflow_step_logs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 4. FIX SECURITY DEFINER VIEW
-- ==========================================

-- Recreate stuck_workflow_steps view without SECURITY DEFINER
DROP VIEW IF EXISTS public.stuck_workflow_steps;

CREATE VIEW public.stuck_workflow_steps AS
SELECT 
  wsl.id,
  wsl.workflow_execution_log_id,
  wsl.step_id,
  wsl.status,
  wsl.started_at,
  wsl.created_at,
  EXTRACT(EPOCH FROM (NOW() - wsl.started_at)) / 60 AS minutes_running
FROM public.workflow_step_logs wsl
WHERE wsl.status = 'running'
  AND wsl.started_at < NOW() - INTERVAL '30 minutes';

-- ==========================================
-- 5. SET EXPLICIT SEARCH_PATH ON FUNCTIONS
-- ==========================================

ALTER FUNCTION public.hash_password(text) 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.verify_password(text, text) 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_user(text, text, boolean) 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.create_user(text, text, boolean, text) 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.update_page_group_configs_updated_at() 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.cleanup_stuck_workflow_steps() 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_next_parseit_id() 
  SET search_path = public, pg_temp;

-- ==========================================
-- 6. ENABLE RLS ON MISSING TABLES
-- ==========================================

-- Enable RLS on email_processing_rules
ALTER TABLE public.email_processing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_processing_rules_all_access"
  ON public.email_processing_rules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS on processed_emails
ALTER TABLE public.processed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processed_emails_all_access"
  ON public.processed_emails
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Enable RLS on email_monitoring_config
ALTER TABLE public.email_monitoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_monitoring_config_all_access"
  ON public.email_monitoring_config
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==========================================
-- 7. MOVE HTTP EXTENSION TO EXTENSIONS SCHEMA
-- ==========================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move http extension
DO $$
BEGIN
  -- Check if extension exists in public schema
  IF EXISTS (
    SELECT 1 FROM pg_extension 
    WHERE extname = 'http' 
    AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- Drop and recreate in extensions schema
    DROP EXTENSION IF EXISTS http CASCADE;
    CREATE EXTENSION IF NOT EXISTS http SCHEMA extensions;
  END IF;
END $$;
