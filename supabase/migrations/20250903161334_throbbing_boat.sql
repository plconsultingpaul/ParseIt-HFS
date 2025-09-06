/*
  # Add granular permissions to users table

  1. Changes
    - Add permissions column to users table to store granular permission settings
    - Update existing users to have appropriate default permissions based on admin status
    - Update user creation and verification functions to handle permissions

  2. Security
    - Permissions are stored as JSON for flexibility
    - Admin users get all permissions by default
    - Regular users get no permissions by default
*/

-- Add permissions column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions text DEFAULT '{}';

-- Update existing admin users to have all permissions
UPDATE users 
SET permissions = '{"extractionTypes":true,"sftp":true,"api":true,"emailMonitoring":true,"emailRules":true,"processedEmails":true,"userManagement":true}'
WHERE is_admin = true;

-- Update existing non-admin users to have no permissions
UPDATE users 
SET permissions = '{"extractionTypes":false,"sftp":false,"api":false,"emailMonitoring":false,"emailRules":false,"processedEmails":false,"userManagement":false}'
WHERE is_admin = false;

-- Update the create_user function to handle permissions
CREATE OR REPLACE FUNCTION create_user(
  username_input text,
  password_input text,
  is_admin_input boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
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
    default_permissions := '{"extractionTypes":true,"sftp":true,"api":true,"emailMonitoring":true,"emailRules":true,"processedEmails":true,"userManagement":true}';
  ELSE
    default_permissions := '{"extractionTypes":false,"sftp":false,"api":false,"emailMonitoring":false,"emailRules":false,"processedEmails":false,"userManagement":false}';
  END IF;

  -- Insert new user
  INSERT INTO users (username, password_hash, is_admin, permissions, created_at, updated_at)
  VALUES (
    username_input,
    crypt(password_input, gen_salt('bf')),
    is_admin_input,
    default_permissions,
    now(),
    now()
  )
  RETURNING id INTO user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'User created successfully',
    'user_id', user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to create user: ' || SQLERRM
    );
END;
$$;

-- Update the verify_password function to return permissions
CREATE OR REPLACE FUNCTION verify_password(
  username_input text,
  password_input text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
BEGIN
  -- Get user record
  SELECT id, username, password_hash, is_admin, is_active, permissions
  INTO user_record
  FROM users
  WHERE username = username_input;

  -- Check if user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid username or password'
    );
  END IF;

  -- Check if user is active
  IF NOT user_record.is_active THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Account is deactivated'
    );
  END IF;

  -- Verify password
  IF user_record.password_hash = crypt(password_input, user_record.password_hash) THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Login successful',
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
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Login failed: ' || SQLERRM
    );
END;
$$;