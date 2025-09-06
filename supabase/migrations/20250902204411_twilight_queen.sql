/*
  # Add Authentication System

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `username` (text, unique)
      - `password_hash` (text)
      - `is_admin` (boolean)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `users` table
    - Add policies for user management
    - Insert default admin user
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Allow public read access to users" ON users
  FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to users" ON users
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to users" ON users
  FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to users" ON users
  FOR DELETE TO public USING (true);

-- Create function to hash passwords (simple implementation)
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simple hash implementation - in production you'd want bcrypt or similar
  RETURN encode(digest(password || 'salt_key_parseit', 'sha256'), 'hex');
END;
$$;

-- Create function to verify password
CREATE OR REPLACE FUNCTION verify_password(username_input text, password_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record users%ROWTYPE;
  password_hash text;
BEGIN
  -- Get user record
  SELECT * INTO user_record FROM users 
  WHERE username = username_input AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Invalid credentials');
  END IF;
  
  -- Hash the input password
  password_hash := hash_password(password_input);
  
  -- Check if password matches
  IF user_record.password_hash = password_hash THEN
    RETURN json_build_object(
      'success', true, 
      'user', json_build_object(
        'id', user_record.id,
        'username', user_record.username,
        'is_admin', user_record.is_admin,
        'is_active', user_record.is_active
      )
    );
  ELSE
    RETURN json_build_object('success', false, 'message', 'Invalid credentials');
  END IF;
END;
$$;

-- Create function to create user
CREATE OR REPLACE FUNCTION create_user(username_input text, password_input text, is_admin_input boolean DEFAULT false)
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
  
  -- Hash the password
  password_hash := hash_password(password_input);
  
  -- Insert new user
  INSERT INTO users (username, password_hash, is_admin, is_active)
  VALUES (username_input, password_hash, is_admin_input, true)
  RETURNING id INTO user_id;
  
  RETURN json_build_object(
    'success', true, 
    'message', 'User created successfully',
    'user_id', user_id
  );
END;
$$;

-- Insert default admin user (admin / J@ckjohn1)
INSERT INTO users (username, password_hash, is_admin, is_active)
VALUES ('admin', hash_password('J@ckjohn1'), true, true)
ON CONFLICT (username) DO UPDATE SET
  password_hash = hash_password('J@ckjohn1'),
  is_admin = true,
  is_active = true,
  updated_at = now();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);