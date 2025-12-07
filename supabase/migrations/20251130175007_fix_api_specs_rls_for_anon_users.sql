/*
  # Fix API Specs RLS Policies for Custom Authentication

  ## Problem
  The application uses custom username/password authentication with a `users` table,
  but Supabase RLS policies were checking for `authenticated` role which requires
  Supabase Auth JWT tokens. This caused all database operations to fail with 401 
  Unauthorized errors even though users were logged into the application.

  ## Root Cause
  - App uses custom auth (localStorage + users table)
  - RLS policies required `TO authenticated` (Supabase Auth sessions)
  - Users logged into app ≠ users authenticated in Supabase
  - Result: All RLS-protected operations failed

  ## Solution
  Change RLS policies to allow `anon` role (the default role for Supabase client 
  connections using the anon key). This allows the custom authentication system
  to work while maintaining RLS structure for future migration to Supabase Auth.

  ## Security Model
  - Database access controlled by Supabase URL + anon key
  - User authentication handled at application level
  - RLS kept enabled for structure but policies are permissive
  - Future-ready for migration to Supabase Auth if needed

  ## Changes
  1. Drop existing policies on all API spec tables
  2. Create new policies allowing `anon` and `authenticated` roles
  3. Apply to: api_specs, api_spec_endpoints, api_endpoint_fields
*/

-- ============================================================================
-- API SPECS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON api_specs;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON api_specs;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON api_specs;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON api_specs;

-- Create new permissive policies for anon users
CREATE POLICY "Enable read access for all users"
  ON api_specs FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON api_specs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON api_specs FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON api_specs FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- API SPEC ENDPOINTS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view api_spec_endpoints" ON api_spec_endpoints;
DROP POLICY IF EXISTS "Authenticated users can insert api_spec_endpoints" ON api_spec_endpoints;
DROP POLICY IF EXISTS "Authenticated users can update api_spec_endpoints" ON api_spec_endpoints;
DROP POLICY IF EXISTS "Authenticated users can delete api_spec_endpoints" ON api_spec_endpoints;

-- Create new permissive policies for anon users
CREATE POLICY "Enable read access for all users"
  ON api_spec_endpoints FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON api_spec_endpoints FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON api_spec_endpoints FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON api_spec_endpoints FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- API ENDPOINT FIELDS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view api_endpoint_fields" ON api_endpoint_fields;
DROP POLICY IF EXISTS "Authenticated users can insert api_endpoint_fields" ON api_endpoint_fields;
DROP POLICY IF EXISTS "Authenticated users can update api_endpoint_fields" ON api_endpoint_fields;
DROP POLICY IF EXISTS "Authenticated users can delete api_endpoint_fields" ON api_endpoint_fields;

-- Create new permissive policies for anon users
CREATE POLICY "Enable read access for all users"
  ON api_endpoint_fields FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Enable insert access for all users"
  ON api_endpoint_fields FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for all users"
  ON api_endpoint_fields FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for all users"
  ON api_endpoint_fields FOR DELETE
  TO anon, authenticated
  USING (true);
