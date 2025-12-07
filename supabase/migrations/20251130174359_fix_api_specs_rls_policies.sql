/*
  # Fix API Specs Row Level Security Policies

  ## Overview
  This migration fixes RLS policy issues on the api_specs table that occurred after removing the trading_partner_id column.
  When table schemas change, RLS policies sometimes need to be refreshed to work correctly with the new structure.

  ## Problem
  - Users getting "new row violates row-level security policy" error (code 42501)
  - INSERT operations failing even though policies exist
  - Policies may have stale references after schema changes

  ## Solution
  - Drop all existing RLS policies on api_specs table
  - Recreate clean policies with simple, explicit conditions
  - Ensure policies work with current schema (api_endpoint_id OR secondary_api_id)
  - Use straightforward `(true)` conditions for authenticated users

  ## Changes
  1. Drop old policies on api_specs table
  2. Recreate SELECT policy for authenticated users
  3. Recreate INSERT policy for authenticated users
  4. Recreate UPDATE policy for authenticated users
  5. Recreate DELETE policy for authenticated users

  ## Security
  - All policies require authenticated users
  - No anonymous access allowed
  - Simple boolean conditions (no complex logic)
  - Full CRUD access for authenticated users
*/

-- Drop all existing policies on api_specs table
DROP POLICY IF EXISTS "Authenticated users can view api_specs" ON api_specs;
DROP POLICY IF EXISTS "Authenticated users can insert api_specs" ON api_specs;
DROP POLICY IF EXISTS "Authenticated users can update api_specs" ON api_specs;
DROP POLICY IF EXISTS "Authenticated users can delete api_specs" ON api_specs;

-- Recreate clean RLS policies for api_specs
CREATE POLICY "Enable read access for authenticated users"
  ON api_specs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON api_specs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
  ON api_specs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users"
  ON api_specs FOR DELETE
  TO authenticated
  USING (true);
