/*
  # Fix Execute Button Steps RLS Policies

  1. Problem
    - The execute_button_steps table used a single "FOR ALL TO public" policy
    - This pattern doesn't work with PostgREST - the table was invisible to the API
    - Error: PGRST204 "Could not find a relation of 'execute_button_steps' in the schema cache"

  2. Fix
    - Drop the existing "FOR ALL" policy
    - Create 4 separate policies (SELECT, INSERT, UPDATE, DELETE) with "TO anon, authenticated"
    - This matches the working pattern used by execute_button_categories and other tables

  3. Security
    - Policies allow anon and authenticated users to access the table
    - Matches the existing security model for execute button system
*/

-- Drop the existing policy that doesn't work
DROP POLICY IF EXISTS "Allow public access to execute button steps" ON execute_button_steps;

-- Create separate policies matching the working pattern
CREATE POLICY "Allow public read access to execute_button_steps"
  ON execute_button_steps FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert access to execute_button_steps"
  ON execute_button_steps FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update access to execute_button_steps"
  ON execute_button_steps FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to execute_button_steps"
  ON execute_button_steps FOR DELETE
  TO anon, authenticated
  USING (true);
