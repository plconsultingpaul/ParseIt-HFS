/*
  # Add Cron Settings Table

  This migration adds a table to store Supabase credentials needed for pg_cron to call edge functions.

  1. New Tables
    - `cron_settings` - Stores Supabase URL and anon key for cron jobs

  2. Security
    - Enable RLS on cron_settings table
    - Add policies for authenticated and anon users to read/update settings

  3. Updated Functions
    - Update schedule_email_monitoring to read from cron_settings
*/

-- Create cron_settings table
CREATE TABLE IF NOT EXISTS cron_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_url text NOT NULL,
  supabase_anon_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cron_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow read access to cron_settings"
  ON cron_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow update access to cron_settings"
  ON cron_settings
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert access to cron_settings"
  ON cron_settings
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Update schedule_email_monitoring function to use cron_settings table
CREATE OR REPLACE FUNCTION public.schedule_email_monitoring()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions
AS $$
DECLARE
  v_config record;
  v_cron_settings record;
  v_cron_expression text;
  v_job_id bigint;
  v_existing_job_id bigint;
BEGIN
  -- Get the email monitoring config
  SELECT * INTO v_config FROM email_monitoring_config LIMIT 1;
  
  IF v_config IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No email monitoring configuration found');
  END IF;

  -- Get the cron settings (Supabase URL and anon key)
  SELECT * INTO v_cron_settings FROM cron_settings LIMIT 1;

  IF v_cron_settings IS NULL OR v_cron_settings.supabase_url IS NULL OR v_cron_settings.supabase_anon_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cron settings not configured. Please configure Supabase URL and Anon Key in the Scheduled Monitoring settings.'
    );
  END IF;

  -- First, unschedule any existing job
  IF v_config.cron_job_id IS NOT NULL THEN
    BEGIN
      PERFORM cron.unschedule(v_config.cron_job_id);
    EXCEPTION WHEN OTHERS THEN
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
      UPDATE public.email_monitoring_config SET last_cron_run = NOW(), next_cron_run = NOW() + interval '%s minutes';
      $cron$,
      v_cron_settings.supabase_url,
      v_cron_settings.supabase_anon_key,
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

-- Update get_email_cron_status to include cron_settings info
CREATE OR REPLACE FUNCTION public.get_email_cron_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_config record;
  v_cron_settings record;
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

  -- Get cron settings
  SELECT * INTO v_cron_settings FROM cron_settings LIMIT 1;

  -- Check if the cron job exists
  SELECT * INTO v_job FROM cron.job WHERE jobname = 'email-monitoring-poll';
  
  -- Get the last run details
  IF v_job IS NOT NULL THEN
    SELECT * INTO v_last_run 
    FROM cron.job_run_details 
    WHERE jobid = v_job.jobid 
    ORDER BY start_time DESC 
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'configured', true,
    'cron_settings_configured', v_cron_settings IS NOT NULL,
    'supabase_url_set', v_cron_settings.supabase_url IS NOT NULL AND v_cron_settings.supabase_url != '',
    'supabase_anon_key_set', v_cron_settings.supabase_anon_key IS NOT NULL AND v_cron_settings.supabase_anon_key != '',
    'enabled', COALESCE(v_config.cron_enabled, false),
    'job_exists', v_job IS NOT NULL,
    'job_id', v_job.jobid,
    'schedule', COALESCE(v_config.cron_schedule, v_job.schedule),
    'polling_interval', v_config.polling_interval,
    'last_cron_run', v_config.last_cron_run,
    'next_cron_run', v_config.next_cron_run,
    'last_run_status', v_last_run.status,
    'last_run_time', v_last_run.start_time,
    'last_run_end', v_last_run.end_time,
    'last_run_return_message', v_last_run.return_message
  );
END;
$$;

-- Function to save cron settings
CREATE OR REPLACE FUNCTION public.save_cron_settings(p_supabase_url text, p_supabase_anon_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing record;
BEGIN
  SELECT * INTO v_existing FROM cron_settings LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO cron_settings (supabase_url, supabase_anon_key)
    VALUES (p_supabase_url, p_supabase_anon_key);
  ELSE
    UPDATE cron_settings 
    SET supabase_url = p_supabase_url, 
        supabase_anon_key = p_supabase_anon_key,
        updated_at = NOW()
    WHERE id = v_existing.id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to get cron settings (without exposing full anon key)
CREATE OR REPLACE FUNCTION public.get_cron_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings record;
BEGIN
  SELECT * INTO v_settings FROM cron_settings LIMIT 1;

  IF v_settings IS NULL THEN
    RETURN jsonb_build_object(
      'configured', false,
      'supabase_url', '',
      'supabase_anon_key_masked', ''
    );
  END IF;

  RETURN jsonb_build_object(
    'configured', true,
    'supabase_url', v_settings.supabase_url,
    'supabase_anon_key_masked', 
      CASE 
        WHEN v_settings.supabase_anon_key IS NOT NULL AND LENGTH(v_settings.supabase_anon_key) > 20 
        THEN SUBSTRING(v_settings.supabase_anon_key, 1, 10) || '...' || SUBSTRING(v_settings.supabase_anon_key, LENGTH(v_settings.supabase_anon_key) - 9)
        ELSE '(not set)'
      END
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.save_cron_settings(text, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_cron_settings() TO authenticated, anon;
