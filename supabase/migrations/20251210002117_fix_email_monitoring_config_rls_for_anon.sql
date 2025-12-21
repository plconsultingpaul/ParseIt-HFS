/*
  # Fix Email Monitoring Config RLS Policies for Custom Auth
  
  ## Problem
  The email_monitoring_config table has an RLS policy for 'authenticated' role only.
  Since this app uses custom authentication (not Supabase Auth), all requests come 
  in as 'anon' role, causing 401 errors on save operations.
  
  ## Changes
  1. Drop the existing 'email_monitoring_config_all_access' policy (authenticated role)
  2. Add new SELECT policy for anon role
  3. Add new INSERT policy for anon role
  4. Add new UPDATE policy for anon role
  5. Add new DELETE policy for anon role
  
  ## Security Note
  This matches the pattern used by other config tables (sftp_config, api_settings)
  which also use anon access for the custom auth system.
*/

-- Drop the existing policy that only allows authenticated role
DROP POLICY IF EXISTS "email_monitoring_config_all_access" ON email_monitoring_config;

-- Create policies for anon role to match custom auth pattern
CREATE POLICY "Allow anon select on email_monitoring_config"
  ON email_monitoring_config
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on email_monitoring_config"
  ON email_monitoring_config
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on email_monitoring_config"
  ON email_monitoring_config
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on email_monitoring_config"
  ON email_monitoring_config
  FOR DELETE
  TO anon
  USING (true);