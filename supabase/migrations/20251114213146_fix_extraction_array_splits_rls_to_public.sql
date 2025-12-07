/*
  # Fix RLS Policies for extraction_type_array_splits Table

  ## Issue
  The existing RLS policies target the 'authenticated' role but this application uses
  custom authentication with the anon key and doesn't use Supabase Auth. This causes
  INSERT/UPDATE/DELETE operations to fail with "401 Unauthorized" errors.

  ## Changes
  1. Drop existing policies that target the 'authenticated' role
  2. Create new policy targeting the 'public' role (matching transformation_types pattern)
  3. Use a single FOR ALL policy for simplicity and maintainability

  ## Security Notes
  - Array split configs are system-wide configuration settings
  - The application enforces user authentication and authorization at the application layer
  - This policy allows the anon key to access the table while RLS remains enabled
  - Matches the pattern used successfully in transformation_types and extraction_types tables
*/

-- Drop existing policies that require Supabase Auth
DROP POLICY IF EXISTS "Authenticated users can view array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Authenticated users can insert array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Authenticated users can update array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Authenticated users can delete array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Users can view array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Users can insert array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Users can update array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Users can delete array split configs" ON extraction_type_array_splits;

-- Create comprehensive public access policy (matches transformation_types pattern)
CREATE POLICY "Allow public access to extraction type array splits"
  ON extraction_type_array_splits
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
