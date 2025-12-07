/*
  # Fix User Extraction Types RLS Policy

  Replace auth.uid() based policies with standard public access policy
  to match the pattern used throughout the application.
*/

-- Drop the existing policies that use auth.uid()
DROP POLICY IF EXISTS "Users can read own extraction type assignments" ON user_extraction_types;
DROP POLICY IF EXISTS "Admins can manage all extraction type assignments" ON user_extraction_types;

-- Create the standard public access policy
CREATE POLICY "Allow public access to user extraction types"
  ON user_extraction_types
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
