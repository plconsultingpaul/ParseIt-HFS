/*
  # Fix Field Mapping Functions RLS Policies

  1. Problem
    - The field_mapping_functions table has RLS policies for 'authenticated' role
    - This project uses custom authentication, requiring 'public' role policies
    - Users cannot insert/update/delete field mapping functions

  2. Changes
    - Drop existing authenticated policies
    - Add 4 new policies for 'public' role matching project pattern:
      - SELECT: Allow public read access
      - INSERT: Allow public insert access
      - UPDATE: Allow public update access
      - DELETE: Allow public delete access

  3. Security
    - Policies match the existing pattern used by other tables in this project
    - Uses custom authentication at application level
*/

DROP POLICY IF EXISTS "Authenticated users can read all functions" ON field_mapping_functions;
DROP POLICY IF EXISTS "Authenticated users can insert functions" ON field_mapping_functions;
DROP POLICY IF EXISTS "Authenticated users can update functions" ON field_mapping_functions;
DROP POLICY IF EXISTS "Authenticated users can delete functions" ON field_mapping_functions;
DROP POLICY IF EXISTS "Public can read functions for execution" ON field_mapping_functions;

CREATE POLICY "Allow public read access to field mapping functions"
  ON field_mapping_functions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to field mapping functions"
  ON field_mapping_functions
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to field mapping functions"
  ON field_mapping_functions
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to field mapping functions"
  ON field_mapping_functions
  FOR DELETE
  TO public
  USING (true);
