/*
  # Fix admin user login

  1. Ensure admin user exists with correct password
  2. Fix password verification function
  3. Add proper error handling
*/

-- First, ensure the admin user exists with the correct password hash
DO $$
BEGIN
  -- Delete any existing admin user to start fresh
  DELETE FROM users WHERE username = 'admin';
  
  -- Insert the admin user with the correct password hash for 'J@ckjohn1'
  INSERT INTO users (
    id,
    username, 
    password_hash, 
    is_admin, 
    is_active,
    permissions,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    'admin',
    crypt('J@ckjohn1', gen_salt('bf')),
    true,
    true,
    '{"extractionTypes": true, "sftp": true, "api": true, "emailMonitoring": true, "emailRules": true, "processedEmails": true, "userManagement": true}',
    now(),
    now()
  );
END $$;

-- Create or replace the password verification function
CREATE OR REPLACE FUNCTION verify_password(username_input text, password_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Verify password
  IF user_record.password_hash = crypt(password_input, user_record.password_hash) THEN
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

-- Create or replace the create_user function
CREATE OR REPLACE FUNCTION create_user(username_input text, password_input text, is_admin_input boolean DEFAULT false)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
    default_permissions := '{"extractionTypes": true, "sftp": true, "api": true, "emailMonitoring": true, "emailRules": true, "processedEmails": true, "userManagement": true}';
  ELSE
    default_permissions := '{"extractionTypes": false, "sftp": false, "api": false, "emailMonitoring": false, "emailRules": false, "processedEmails": false, "userManagement": false}';
  END IF;
  
  -- Insert new user
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
    crypt(password_input, gen_salt('bf')),
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