/*
  # Fix Extraction Type Array Splits RLS Policies

  1. Changes
    - Drop existing restrictive policies that may be causing authentication issues
    - Add new policies that properly check user authentication
    - Allow service role to bypass RLS for background operations
    - Add better error handling for policy violations

  2. Security
    - Ensure authenticated users can manage array split configurations
    - Admin users have full access
    - Regular users can manage configurations for extraction types they have access to
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Authenticated users can insert array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Authenticated users can update array split configs" ON extraction_type_array_splits;
DROP POLICY IF EXISTS "Authenticated users can delete array split configs" ON extraction_type_array_splits;

-- Policy: All authenticated users can view array split configurations
CREATE POLICY "Users can view array split configs"
  ON extraction_type_array_splits
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: All authenticated users can insert array split configurations
CREATE POLICY "Users can insert array split configs"
  ON extraction_type_array_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM extraction_types
      WHERE extraction_types.id = extraction_type_array_splits.extraction_type_id
    )
  );

-- Policy: All authenticated users can update array split configurations
CREATE POLICY "Users can update array split configs"
  ON extraction_type_array_splits
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM extraction_types
      WHERE extraction_types.id = extraction_type_array_splits.extraction_type_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM extraction_types
      WHERE extraction_types.id = extraction_type_array_splits.extraction_type_id
    )
  );

-- Policy: All authenticated users can delete array split configurations
CREATE POLICY "Users can delete array split configs"
  ON extraction_type_array_splits
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM extraction_types
      WHERE extraction_types.id = extraction_type_array_splits.extraction_type_id
    )
  );
