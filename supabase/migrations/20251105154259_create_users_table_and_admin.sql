/*
  # Create users table and default admin user

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `username` (text, unique, not null)
      - `password_hash` (text, not null)
      - `email` (text, nullable)
      - `is_admin` (boolean, default false)
      - `is_active` (boolean, default true)
      - `role` (text, check constraint for admin/user/vendor)
      - `permissions` (text, JSON string)
      - `preferred_upload_mode` (text, manual/auto)
      - `current_zone` (text, default empty)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on users table
    - Add public access policy for custom authentication system

  3. Default Data
    - Create admin user with username "admin" and password "J@ckjohn1"
    - Admin has full permissions
*/

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  email text,
  is_admin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'vendor')),
  permissions text,
  preferred_upload_mode text DEFAULT 'manual' CHECK (preferred_upload_mode IN ('manual', 'auto')),
  current_zone text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create public access policy for custom auth
DROP POLICY IF EXISTS "Allow public access to users for custom auth" ON users;
CREATE POLICY "Allow public access to users for custom auth"
  ON users
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create default admin user with password "J@ckjohn1"
INSERT INTO users (
  username,
  password_hash,
  is_admin,
  is_active,
  role,
  email,
  permissions,
  preferred_upload_mode,
  current_zone
)
SELECT
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
    'processedEmails', true,
    'extractionLogs', true,
    'userManagement', true,
    'workflowManagement', true
  )::text,
  'manual',
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE username = 'admin'
);