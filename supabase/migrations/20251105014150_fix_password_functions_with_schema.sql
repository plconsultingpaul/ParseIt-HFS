/*
  # Fix Password Functions to Use Correct Schema

  ## Summary
  This migration updates all password-related functions to use the correct schema
  for pgcrypto functions (extensions.crypt and extensions.gen_salt).

  ## Changes Made
  1. **Update verify_password function**
     - Uses extensions.crypt() instead of crypt()
     - Properly references the extensions schema

  2. **Update create_user functions (both overloads)**
     - Uses extensions.crypt() and extensions.gen_salt()
     - Ensures new users are created with proper bcrypt hashes

  3. **Recreate admin user with correct hash**
     - Deletes and recreates admin user
     - Uses extensions schema functions for proper bcrypt hashing

  ## Notes
  - pgcrypto extension lives in the extensions schema in Supabase
  - All functions must explicitly reference extensions.crypt() and extensions.gen_salt()
*/

-- Update verify_password function to use extensions.crypt
CREATE OR REPLACE FUNCTION verify_password(username_input text, password_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
  
  -- Verify password using extensions.crypt
  IF user_record.password_hash = extensions.crypt(password_input, user_record.password_hash) THEN
    RETURN json_build_object(
      'success', true,
      'user', json_build_object(
        'id', user_record.id,
        'username', user_record.username,
        'is_admin', user_record.is_admin,
        'is_active', user_record.is_active,
        'permissions', user_record.permissions
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

-- Update create_user function (3 parameter version)
CREATE OR REPLACE FUNCTION create_user(
  username_input text, 
  password_input text, 
  is_admin_input boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  new_user_id uuid;
  default_permissions text;
BEGIN
  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM users WHERE username = username_input) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Username already exists'
    );
  END IF;
  
  -- Set default permissions based on admin status
  IF is_admin_input THEN
    default_permissions := '{"extractionTypes": true, "transformationTypes": true, "sftp": true, "api": true, "emailMonitoring": true, "emailRules": true, "processedEmails": true, "extractionLogs": true, "userManagement": true, "workflowManagement": true}';
  ELSE
    default_permissions := '{"extractionTypes": false, "transformationTypes": false, "sftp": false, "api": false, "emailMonitoring": false, "emailRules": false, "processedEmails": false, "extractionLogs": false, "userManagement": false, "workflowManagement": false}';
  END IF;
  
  -- Insert new user with extensions.crypt
  INSERT INTO users (
    username,
    password_hash,
    is_admin,
    is_active,
    permissions,
    created_at,
    updated_at
  ) VALUES (
    username_input,
    extensions.crypt(password_input, extensions.gen_salt('bf')),
    is_admin_input,
    true,
    default_permissions,
    now(),
    now()
  ) RETURNING id INTO new_user_id;
  
  RETURN json_build_object(
    'success', true,
    'message', 'User created successfully',
    'user_id', new_user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to create user: ' || SQLERRM
    );
END;
$$;

-- Update create_user function (4 parameter version with email)
CREATE OR REPLACE FUNCTION create_user(
  username_input text, 
  password_input text, 
  is_admin_input boolean DEFAULT false,
  email_input text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  user_id uuid;
  password_hash text;
BEGIN
  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM users WHERE username = username_input) THEN
    RETURN json_build_object('success', false, 'message', 'Username already exists');
  END IF;
  
  -- Check if email already exists (when provided)
  IF email_input IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE email = email_input) THEN
    RETURN json_build_object('success', false, 'message', 'Email already exists');
  END IF;
  
  -- Hash the password using extensions.crypt
  password_hash := extensions.crypt(password_input, extensions.gen_salt('bf'));
  
  -- Insert new user
  INSERT INTO users (username, password_hash, is_admin, is_active, email)
  VALUES (username_input, password_hash, is_admin_input, true, email_input)
  RETURNING id INTO user_id;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'User created successfully',
    'user_id', user_id
  );
END;
$$;

-- Delete and recreate admin user with proper bcrypt hash
DELETE FROM users WHERE username = 'admin';

INSERT INTO users (
  id,
  username, 
  password_hash, 
  is_admin, 
  is_active,
  role,
  permissions,
  email,
  preferred_upload_mode,
  current_zone,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin',
  extensions.crypt('J@ckjohn1', extensions.gen_salt('bf')),
  true,
  true,
  'admin',
  '{"extractionTypes": true, "transformationTypes": true, "sftp": true, "api": true, "emailMonitoring": true, "emailRules": true, "processedEmails": true, "extractionLogs": true, "userManagement": true, "workflowManagement": true}',
  null,
  'manual',
  '',
  now(),
  now()
);
