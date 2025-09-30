/*
  # Add User Roles Support

  1. Schema Changes
    - Add `role` column to `users` table
    - Add check constraint for valid role values
    - Update existing users with appropriate roles
    - Add performance index

  2. Data Migration
    - Set admin users to 'admin' role
    - Set remaining users to 'user' role
    - Make role column NOT NULL after population

  3. Security
    - Maintain existing RLS policies
    - Add index for role-based queries
*/

-- Add the role column first (nullable initially)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text;

-- Update existing admin users to have 'admin' role
UPDATE users SET role = 'admin' WHERE is_admin = true;

-- Update remaining users to have 'user' role
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Now add the check constraint after the column exists and is populated
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_role_check' 
    AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'user', 'vendor'));
  END IF;
END $$;

-- Make the role column NOT NULL after populating values
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

-- Set default value for new users
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

-- Add index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update the updated_at timestamp
UPDATE users SET updated_at = now() WHERE role IS NOT NULL;