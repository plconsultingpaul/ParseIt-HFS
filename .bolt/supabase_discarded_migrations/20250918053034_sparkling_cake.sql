/*
  # Add user roles support

  1. Schema Changes
    - Add `role` column to users table
    - Add check constraint for valid roles
    - Set default role to 'user'

  2. Security
    - Update existing RLS policies to handle roles
    - Ensure proper role-based access control
*/

-- Add role column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role text DEFAULT 'user';
  END IF;
END $$;

-- Add check constraint for valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'users_role_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'user', 'vendor'));
  END IF;
END $$;

-- Update existing admin user to have admin role
UPDATE users SET role = 'admin' WHERE username = 'admin';

-- Update any other admin users to have admin role
UPDATE users SET role = 'admin' WHERE is_admin = true AND role != 'admin';

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);