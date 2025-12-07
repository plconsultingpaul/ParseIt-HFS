/*
  # Fix Admin User Login
  
  This migration ensures the admin user exists with the correct credentials
  and recreates the verify_password function to ensure it works properly.
  
  ## Changes
  1. Recreate verify_password function with proper security settings
  2. Ensure admin user exists with correct password hash
  3. Set all required admin permissions
  
  ## Admin Credentials
  - Username: admin
  - Password: J@ckjohn1
  - Role: admin
  - Full permissions enabled
  
  ## Security
  - Uses pgcrypto crypt() for secure password hashing
  - SECURITY DEFINER with explicit search_path
  - RLS policies already allow public access for custom auth
*/

-- Recreate verify_password function to ensure it's working correctly
CREATE OR REPLACE FUNCTION verify_password(username_input TEXT, password_input TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_record users%ROWTYPE;
  result json;
BEGIN
  -- Find the user
  SELECT * INTO user_record
  FROM users 
  WHERE username = username_input AND is_active = true;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid username or password'
    );
  END IF;
  
  -- Verify password using crypt
  IF user_record.password_hash = crypt(password_input, user_record.password_hash) THEN
    RETURN json_build_object(
      'success', true,
      'user', json_build_object(
        'id', user_record.id,
        'username', user_record.username,
        'is_admin', user_record.is_admin,
        'is_active', user_record.is_active,
        'permissions', user_record.permissions,
        'role', user_record.role
      )
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid username or password'
    );
  END IF;
END;
$$;

-- Delete existing admin user if present to ensure clean slate
DELETE FROM users WHERE username = 'admin';

-- Create admin user with correct password hash
INSERT INTO users (
  username,
  password_hash,
  is_admin,
  is_active,
  role,
  email,
  permissions,
  preferred_upload_mode,
  current_zone,
  created_at,
  updated_at
) VALUES (
  'admin',
  crypt('J@ckjohn1', gen_salt('bf')),
  true,
  true,
  'admin',
  null,
  json_build_object(
    'extractionTypes', true,
    'transformationTypes', true,
    'sftp', true,
    'api', true,
    'emailMonitoring', true,
    'emailRules', true,
    'processedEmails', true,
    'extractionLogs', true,
    'userManagement', true,
    'workflowManagement', true
  )::text,
  'manual',
  '',
  now(),
  now()
);
