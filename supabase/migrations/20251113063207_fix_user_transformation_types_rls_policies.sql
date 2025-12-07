/*
  # Fix RLS Policies for user_transformation_types Table

  1. Changes
    - Drop existing RLS policies that use auth.uid()
    - Add standard public access policy used throughout the application
    
  2. Security
    - Replaces auth.uid() pattern with application's standard public access pattern
    - Maintains consistency with other tables in the application
    
  3. Notes
    - This fix mirrors the pattern used for user_extraction_types table
    - The application handles authentication at the application layer, not database layer
*/

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "Users can read own transformation type assignments" ON user_transformation_types;
DROP POLICY IF EXISTS "Admins can manage all transformation type assignments" ON user_transformation_types;

-- Add standard public access policy
CREATE POLICY "Enable all access for user_transformation_types"
  ON user_transformation_types
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);