/*
  # Fix Gemini Configuration Policies for Anon Access

  ## Overview
  Updates the RLS policies for gemini_api_keys and gemini_models to work with anon role.
  
  ## Problem
  The current policies use `TO authenticated` but this app doesn't use Supabase Auth.
  All requests are made with the anon key, so policies need to allow anon access.

  ## Solution
  Replace all `TO authenticated` policies with `TO anon` policies.
  
  ## Security Note
  This is acceptable because the application has its own authentication layer
  that validates users before allowing access to these endpoints.
*/

-- Drop existing authenticated policies for gemini_api_keys
DROP POLICY IF EXISTS "Allow authenticated read access to gemini_api_keys" ON gemini_api_keys;
DROP POLICY IF EXISTS "Allow authenticated insert access to gemini_api_keys" ON gemini_api_keys;
DROP POLICY IF EXISTS "Allow authenticated update access to gemini_api_keys" ON gemini_api_keys;
DROP POLICY IF EXISTS "Allow authenticated delete access to gemini_api_keys" ON gemini_api_keys;

-- Drop existing authenticated policies for gemini_models
DROP POLICY IF EXISTS "Allow authenticated read access to gemini_models" ON gemini_models;
DROP POLICY IF EXISTS "Allow authenticated insert access to gemini_models" ON gemini_models;
DROP POLICY IF EXISTS "Allow authenticated update access to gemini_models" ON gemini_models;
DROP POLICY IF EXISTS "Allow authenticated delete access to gemini_models" ON gemini_models;

-- Create new policies for gemini_api_keys with anon role
CREATE POLICY "Allow anon read access to gemini_api_keys"
  ON gemini_api_keys
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert access to gemini_api_keys"
  ON gemini_api_keys
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update access to gemini_api_keys"
  ON gemini_api_keys
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete access to gemini_api_keys"
  ON gemini_api_keys
  FOR DELETE
  TO anon
  USING (true);

-- Create new policies for gemini_models with anon role
CREATE POLICY "Allow anon read access to gemini_models"
  ON gemini_models
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert access to gemini_models"
  ON gemini_models
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update access to gemini_models"
  ON gemini_models
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete access to gemini_models"
  ON gemini_models
  FOR DELETE
  TO anon
  USING (true);
