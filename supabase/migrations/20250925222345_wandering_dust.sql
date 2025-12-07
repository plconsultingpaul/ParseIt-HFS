/*
  # Add verify_password RPC function

  1. Functions
    - `verify_password(username_input TEXT, password_input TEXT)` - Verifies user credentials using proper password hashing
    
  2. Security
    - Uses crypt() function for secure password verification
    - Returns consistent error messages to prevent username enumeration
    - Only checks active users
    
  3. Return Format
    - Returns JSON object with success boolean and user data or error message
*/

-- Create the verify_password function
CREATE OR REPLACE FUNCTION verify_password(username_input TEXT, password_input TEXT)
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