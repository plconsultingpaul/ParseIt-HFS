/*
  # Fix RLS Policies for Custom Authentication System
  
  The app uses a custom authentication system (not Supabase Auth), 
  storing users in a custom 'users' table. The previous migration 
  changed policies to require 'TO authenticated' which requires 
  Supabase Auth sessions. This fix changes policies to 'TO public' 
  to work with the custom auth system.
  
  ## Changes
  - Drop extraction_types policies requiring Supabase Auth
  - Create new extraction_types policies using public role
  - Drop sftp_config policies requiring Supabase Auth
  - Create new sftp_config policies using public role
*/

-- =====================================================
-- FIX EXTRACTION_TYPES RLS POLICIES
-- =====================================================

-- Drop the current policies that require Supabase Auth
DROP POLICY IF EXISTS "Users can read extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can insert extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can update extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can delete extraction types" ON extraction_types;

-- Create new policies that work with custom auth (using public role)
CREATE POLICY "Allow public read access to extraction types"
  ON extraction_types FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to extraction types"
  ON extraction_types FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to extraction types"
  ON extraction_types FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to extraction types"
  ON extraction_types FOR DELETE
  TO public
  USING (true);

-- =====================================================
-- FIX SFTP_CONFIG RLS POLICIES
-- =====================================================

-- Drop the current policies that require Supabase Auth
DROP POLICY IF EXISTS "Users can read sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can insert sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can update sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can delete sftp config" ON sftp_config;

-- Create new policies that work with custom auth (using public role)
CREATE POLICY "Allow public read access to sftp config"
  ON sftp_config FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to sftp config"
  ON sftp_config FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to sftp config"
  ON sftp_config FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to sftp config"
  ON sftp_config FOR DELETE
  TO public
  USING (true);