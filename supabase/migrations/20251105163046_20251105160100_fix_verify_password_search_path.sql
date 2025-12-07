/*
  # Fix verify_password Function Search Path
  
  This migration fixes the verify_password function to properly access the crypt() function
  from the pgcrypto extension which is installed in the 'extensions' schema.
  
  ## Problem
  The pgcrypto extension is installed in the 'extensions' schema, but the function's
  search_path was set to 'public, pg_temp', which doesn't include the extensions schema.
  This caused the error: "function crypt(text, text) does not exist"
  
  ## Solution
  Update the search_path to include 'extensions' schema: 'public, extensions, pg_temp'
  
  ## Changes
  - Recreate verify_password function with correct search_path
  - Recreate create_user function with correct search_path
  - Recreate hash_password function with correct search_path
*/

-- Fix verify_password function with correct search_path
CREATE OR REPLACE FUNCTION verify_password(username_input TEXT, password_input TEXT)
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

-- Fix create_user function with correct search_path
CREATE OR REPLACE FUNCTION create_user(
  username_input TEXT,
  password_input TEXT,
  is_admin_input BOOLEAN DEFAULT FALSE,
  role_input TEXT DEFAULT 'user',
  email_input TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  new_user_id UUID;
  default_permissions TEXT;
BEGIN
  -- Validate input
  IF username_input IS NULL OR trim(username_input) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Username is required'
    );
  END IF;
  
  IF password_input IS NULL OR trim(password_input) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Password is required'
    );
  END IF;
  
  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM users WHERE username = trim(username_input)) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Username already exists'
    );
  END IF;
  
  -- Set default permissions based on admin status
  IF is_admin_input THEN
    default_permissions := json_build_object(
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
    )::text;
  ELSE
    default_permissions := json_build_object(
      'extractionTypes', false,
      'transformationTypes', false,
      'sftp', false,
      'api', false,
      'emailMonitoring', false,
      'emailRules', false,
      'processedEmails', false,
      'extractionLogs', false,
      'userManagement', false,
      'workflowManagement', false
    )::text;
  END IF;
  
  -- Create the user with hashed password
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
    trim(username_input),
    crypt(password_input, gen_salt('bf')),
    is_admin_input,
    true,
    COALESCE(role_input, CASE WHEN is_admin_input THEN 'admin' ELSE 'user' END),
    email_input,
    default_permissions,
    'manual',
    '',
    now(),
    now()
  ) RETURNING id INTO new_user_id;
  
  IF new_user_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'message', 'User created successfully',
      'user_id', new_user_id
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to create user'
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error creating user: ' || SQLERRM
    );
END;
$$;

-- Fix hash_password function with correct search_path
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$;
