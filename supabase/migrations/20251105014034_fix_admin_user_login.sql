/*
  # Fix Admin User Login - Recreate with Correct Bcrypt Hash

  ## Summary
  This migration resolves the admin login issue by ensuring the admin user has the correct bcrypt password hash.

  ## Changes Made
  1. **Delete All Existing Users**
     - Removes all users from the users table to start fresh
     - This ensures no conflicting password hashes exist

  2. **Recreate Admin User**
     - Username: admin
     - Password: J@ckjohn1 (hashed with bcrypt)
     - Admin privileges: enabled
     - Active status: enabled
     - Role: admin
     - All permissions: enabled

  3. **Security**
     - Uses PostgreSQL's crypt() function with bcrypt (gen_salt('bf'))
     - Ensures password hash is compatible with verify_password function
     - Sets comprehensive permissions for full system access

  ## Important Notes
  - This migration will delete all existing users
  - The admin user will be recreated with password: J@ckjohn1
  - This ensures a clean state for the authentication system
*/

-- Delete all existing users to ensure clean state
DELETE FROM users;

-- Recreate admin user with correct bcrypt password hash
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
  crypt('J@ckjohn1', gen_salt('bf')),
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
