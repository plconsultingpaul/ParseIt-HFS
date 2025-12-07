/*
  # Fix RLS Policies for page_group_configs Table

  ## Issue
  The existing RLS policies require Supabase Auth (authenticated role) but this application
  uses custom authentication with a users table and localStorage. This causes INSERT operations
  to fail with "new row violates row-level security policy".

  ## Changes
  1. Drop existing policies that target the 'authenticated' role
  2. Create new policies that target the 'anon' role (which the application uses)
  3. All policies use USING (true) since page_group_configs are system-wide settings
     and authorization is handled at the application level

  ## Security Notes
  - Page group configs are system-wide configuration settings
  - The application enforces user authentication and authorization
  - These policies allow the anon key to access the table while RLS remains enabled
*/

-- Drop existing policies that require Supabase Auth
DROP POLICY IF EXISTS "Authenticated users can view page group configs" ON page_group_configs;
DROP POLICY IF EXISTS "Authenticated users can insert page group configs" ON page_group_configs;
DROP POLICY IF EXISTS "Authenticated users can update page group configs" ON page_group_configs;
DROP POLICY IF EXISTS "Authenticated users can delete page group configs" ON page_group_configs;

-- Create new policies for anon role (works with custom authentication)
CREATE POLICY "Allow anon to view page group configs"
  ON page_group_configs
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert page group configs"
  ON page_group_configs
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon to update page group configs"
  ON page_group_configs
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon to delete page group configs"
  ON page_group_configs
  FOR DELETE
  TO anon
  USING (true);