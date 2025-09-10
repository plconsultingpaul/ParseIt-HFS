/*
  # Add user upload mode preference

  1. Schema Changes
    - Add `preferred_upload_mode` column to `users` table
    - Set default value to 'manual' for existing users
    - Add check constraint to ensure valid values

  2. Data Migration
    - Update existing users to have 'manual' as default preference
    - Ensure all users have a valid upload mode preference

  3. Security
    - No RLS changes needed (inherits from existing users table policies)
*/

-- Add preferred_upload_mode column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferred_upload_mode'
  ) THEN
    ALTER TABLE users ADD COLUMN preferred_upload_mode text DEFAULT 'manual';
  END IF;
END $$;

-- Add check constraint to ensure valid upload mode values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_preferred_upload_mode_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_preferred_upload_mode_check 
    CHECK (preferred_upload_mode IN ('manual', 'auto'));
  END IF;
END $$;

-- Update existing users to have 'manual' as default preference
UPDATE users 
SET preferred_upload_mode = 'manual' 
WHERE preferred_upload_mode IS NULL;