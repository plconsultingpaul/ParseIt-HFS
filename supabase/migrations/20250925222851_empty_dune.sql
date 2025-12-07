/*
  # Add create_user RPC function

  1. New Functions
    - `create_user(username_input, password_input, is_admin_input)` - Creates new users with proper password hashing
  
  2. Security
    - Uses SECURITY DEFINER for elevated privileges
    - Validates username uniqueness
    - Hashes passwords using crypt() function
    - Sets appropriate default values for new users
*/

-- Enable pgcrypto extension if not already enabled (for password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the create_user function
CREATE OR REPLACE FUNCTION create_user(
  username_input TEXT,
  password_input TEXT,
  is_admin_input BOOLEAN DEFAULT FALSE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
    permissions,
    preferred_upload_mode,
    current_zone,
    created_at,
    updated_at
  ) VALUES (
    trim(username_input),
    crypt(password_input, gen_salt('bf')), -- Use bcrypt hashing
    is_admin_input,
    true,
    CASE WHEN is_admin_input THEN 'admin' ELSE 'user' END,
    default_permissions,
    'manual',
    '',
    now(),
    now()
  ) RETURNING id INTO new_user_id;
  
  -- Check if user was created successfully
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