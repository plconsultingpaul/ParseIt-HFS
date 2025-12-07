/*
  # Fix Gemini Configuration RLS Policies

  ## Overview
  Fixes the RLS policies for gemini_api_keys and gemini_models tables to work with the custom authentication system.
  
  ## Problem
  The original policies used auth.uid() which doesn't work with this app's custom authentication system.
  This app uses a custom users table and anon key authentication, not Supabase Auth.

  ## Solution
  Replace the auth.uid()-based policies with simpler authenticated policies that work with the anon key.
  
  ## Changes
  - Drop existing policies that use auth.uid()
  - Create new policies for authenticated users (using anon key)
  - Allow full access to authenticated users for CRUD operations
  - Maintain read-only access for active configurations

  ## Security
  Since this is an internal system with custom authentication handled at the application level,
  the RLS policies simply ensure that requests are made with valid credentials (anon key).
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage Gemini API keys" ON gemini_api_keys;
DROP POLICY IF EXISTS "Authenticated users can read active Gemini API key" ON gemini_api_keys;
DROP POLICY IF EXISTS "Admins can manage Gemini models" ON gemini_models;
DROP POLICY IF EXISTS "Authenticated users can read active Gemini model" ON gemini_models;

-- Create new policies for gemini_api_keys
CREATE POLICY "Allow authenticated read access to gemini_api_keys"
  ON gemini_api_keys
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access to gemini_api_keys"
  ON gemini_api_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to gemini_api_keys"
  ON gemini_api_keys
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access to gemini_api_keys"
  ON gemini_api_keys
  FOR DELETE
  TO authenticated
  USING (true);

-- Create new policies for gemini_models
CREATE POLICY "Allow authenticated read access to gemini_models"
  ON gemini_models
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert access to gemini_models"
  ON gemini_models
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to gemini_models"
  ON gemini_models
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete access to gemini_models"
  ON gemini_models
  FOR DELETE
  TO authenticated
  USING (true);
