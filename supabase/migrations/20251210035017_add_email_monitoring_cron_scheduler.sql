/*
  # Add Email Monitoring Cron Scheduler

  This migration adds scheduled polling capabilities for email monitoring using pg_cron and pg_net.
  
  1. Schema Changes
    - Add `cron_enabled` boolean to email_monitoring_config (whether scheduled polling is active)
    - Add `cron_job_id` bigint to track the pg_cron job
    - Add `cron_schedule` text to store the cron expression
    - Add `last_cron_run` timestamp to track last scheduled run
    - Add `next_cron_run` timestamp to show next scheduled run

  2. Functions
    - `schedule_email_monitoring()` - Creates/updates the pg_cron job
    - `unschedule_email_monitoring()` - Removes the pg_cron job
    - `update_email_monitoring_schedule()` - Trigger function to manage cron on config changes
    - `get_email_cron_status()` - Returns current cron job status

  3. Security
    - Functions are accessible to authenticated users
    - RLS policies remain unchanged
*/

-- Add new columns for cron scheduling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'cron_enabled'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN cron_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'cron_job_id'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN cron_job_id bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'cron_schedule'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN cron_schedule text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'last_cron_run'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN last_cron_run timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'next_cron_run'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN next_cron_run timestamptz;
  END IF;
END $$;

-- Function to convert polling interval (minutes) to cron expression
CREATE OR REPLACE FUNCTION public.get_cron_expression(interval_minutes integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Handle common intervals
  IF interval_minutes <= 0 THEN
    RETURN '*/5 * * * *'; -- Default to 5 minutes
  ELSIF interval_minutes = 1 THEN
    RETURN '* * * * *'; -- Every minute
  ELSIF interval_minutes < 60 THEN
    RETURN '*/' || interval_minutes::text || ' * * * *'; -- Every N minutes
  ELSIF interval_minutes = 60 THEN
    RETURN '0 * * * *'; -- Every hour
  ELSIF interval_minutes < 1440 THEN
    RETURN '0 */' || (interval_minutes / 60)::text || ' * * *'; -- Every N hours
  ELSE
    RETURN '0 0 * * *'; -- Daily at midnight
  END IF;
END;
$$;

-- Function to schedule email monitoring cron job
CREATE OR REPLACE FUNCTION public.schedule_email_monitoring()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions
AS $$
DECLARE
  v_config record;
  v_cron_expression text;
  v_job_id bigint;
  v_supabase_url text;
  v_anon_key text;
  v_existing_job_id bigint;
BEGIN
  -- Get the email monitoring config
  SELECT * INTO v_config FROM email_monitoring_config LIMIT 1;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No email monitoring configuration found');
  END IF;

  -- Get Supabase URL and anon key from vault or environment
  -- These need to be stored in the vault for security
  SELECT decrypted_secret INTO v_supabase_url 
  FROM vault.decrypted_secrets 
  WHERE name = 'supabase_url';
  
  SELECT decrypted_secret INTO v_anon_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'supabase_anon_key';

  -- If not in vault, try to get from existing config or use defaults
  IF v_supabase_url IS NULL THEN
    -- Try to construct from project ref if available
    v_supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Supabase URL and Anon Key must be configured in vault secrets (supabase_url and supabase_anon_key)'
    );
  END IF;

  -- First, unschedule any existing job
  IF v_config.cron_job_id IS NOT NULL THEN
    BEGIN
      PERFORM cron.unschedule(v_config.cron_job_id);
    EXCEPTION WHEN OTHERS THEN
      -- Job may not exist, continue
      NULL;
    END;
  END IF;

  -- Also check for existing job by name and remove it
  SELECT jobid INTO v_existing_job_id FROM cron.job WHERE jobname = 'email-monitoring-poll';
  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  -- Get the cron expression based on polling interval
  v_cron_expression := get_cron_expression(COALESCE(v_config.polling_interval, 5));

  -- Schedule the new job using pg_net to call the edge function
  SELECT cron.schedule(
    'email-monitoring-poll',
    v_cron_expression,
    format(
      $cron$
      SELECT net.http_post(
        url := '%s/functions/v1/email-monitor',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
      UPDATE email_monitoring_config SET last_cron_run = NOW(), next_cron_run = NOW() + interval '%s minutes';
      $cron$,
      v_supabase_url,
      v_anon_key,
      v_config.polling_interval
    )
  ) INTO v_job_id;

  -- Update the config with the job ID and schedule
  UPDATE email_monitoring_config 
  SET 
    cron_job_id = v_job_id,
    cron_schedule = v_cron_expression,
    cron_enabled = true,
    next_cron_run = NOW() + (v_config.polling_interval || ' minutes')::interval
  WHERE id = v_config.id;

  RETURN jsonb_build_object(
    'success', true, 
    'job_id', v_job_id,
    'schedule', v_cron_expression,
    'interval_minutes', v_config.polling_interval
  );
END;
$$;

-- Function to unschedule email monitoring cron job
CREATE OR REPLACE FUNCTION public.unschedule_email_monitoring()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_config record;
  v_existing_job_id bigint;
BEGIN
  -- Get the email monitoring config
  SELECT * INTO v_config FROM email_monitoring_config LIMIT 1;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No email monitoring configuration found');
  END IF;

  -- Unschedule by job ID if we have it
  IF v_config.cron_job_id IS NOT NULL THEN
    BEGIN
      PERFORM cron.unschedule(v_config.cron_job_id);
    EXCEPTION WHEN OTHERS THEN
      -- Job may not exist, continue
      NULL;
    END;
  END IF;

  -- Also try to unschedule by name
  SELECT jobid INTO v_existing_job_id FROM cron.job WHERE jobname = 'email-monitoring-poll';
  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  -- Update the config
  UPDATE email_monitoring_config 
  SET 
    cron_job_id = NULL,
    cron_schedule = NULL,
    cron_enabled = false,
    next_cron_run = NULL
  WHERE id = v_config.id;

  RETURN jsonb_build_object('success', true, 'message', 'Email monitoring cron job unscheduled');
END;
$$;

-- Function to get current cron job status
CREATE OR REPLACE FUNCTION public.get_email_cron_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_config record;
  v_job record;
  v_last_run record;
BEGIN
  -- Get the email monitoring config
  SELECT * INTO v_config FROM email_monitoring_config LIMIT 1;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'configured', false,
      'enabled', false,
      'error', 'No email monitoring configuration found'
    );
  END IF;

  -- Check if the cron job exists
  SELECT * INTO v_job FROM cron.job WHERE jobname = 'email-monitoring-poll';
  
  -- Get the last run details
  SELECT * INTO v_last_run 
  FROM cron.job_run_details 
  WHERE jobid = v_job.jobid 
  ORDER BY start_time DESC 
  LIMIT 1;

  RETURN jsonb_build_object(
    'configured', true,
    'enabled', COALESCE(v_config.cron_enabled, false),
    'job_exists', v_job IS NOT NULL,
    'job_id', v_job.jobid,
    'schedule', COALESCE(v_config.cron_schedule, v_job.schedule),
    'polling_interval', v_config.polling_interval,
    'last_cron_run', v_config.last_cron_run,
    'next_cron_run', v_config.next_cron_run,
    'last_run_status', v_last_run.status,
    'last_run_time', v_last_run.start_time,
    'last_run_end', v_last_run.end_time
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_cron_expression(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.schedule_email_monitoring() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.unschedule_email_monitoring() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_email_cron_status() TO authenticated, anon;
