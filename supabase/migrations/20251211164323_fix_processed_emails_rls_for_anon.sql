/*
  # Fix processed_emails RLS to allow anon role access

  ## Problem
  The processed_emails table has RLS enabled with a policy that only allows
  the `authenticated` role. The frontend app uses the anon key without 
  Supabase Auth, so queries come as `anon` role and return empty results.

  ## Solution
  Add a SELECT policy for the `anon` role to allow reading processed emails
  from the Logs page.

  ## Changes
  - Add SELECT policy for `anon` role on `processed_emails` table
*/

-- Add SELECT policy for anon role
CREATE POLICY "Allow anon to read processed emails"
  ON processed_emails
  FOR SELECT
  TO anon
  USING (true);
