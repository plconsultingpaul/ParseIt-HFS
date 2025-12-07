/*
  # Add Email Column to Users Table

  1. Changes
    - Add `email` column to `users` table
      - Type: text
      - Constraint: unique
      - Default: null (optional)
    - Add index on email for efficient lookup
    - Add check constraint for email format validation

  2. Notes
    - Email is optional to maintain backward compatibility
    - Unique constraint ensures no duplicate emails
    - Email format validation ensures data quality
*/

-- Add email column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;

-- Add unique constraint for email (only when email is not null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Add check constraint for email format validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_format_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_email_format_check 
      CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  END IF;
END $$;

-- Create index for better performance on email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Update the create_user function to accept email parameter
CREATE OR REPLACE FUNCTION create_user(
  username_input text, 
  password_input text, 
  is_admin_input boolean DEFAULT false,
  email_input text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Hash the password
  password_hash := hash_password(password_input);
  
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