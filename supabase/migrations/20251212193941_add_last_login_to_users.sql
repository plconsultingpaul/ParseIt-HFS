/*
  # Add Last Login Tracking to Users

  1. Changes
    - Add `last_login` column to `users` table (timestamptz, nullable)
    - This column will store the timestamp of the user's most recent successful login
    - Nullable to handle existing users who haven't logged in since the column was added
    - No default value - will be NULL until first login after this migration
  
  2. Purpose
    - Enable administrators to track when client users last accessed the system
    - Display last login information in User Management interface
    - Help identify inactive accounts
  
  3. Notes
    - Existing users will show NULL (or "Never") until their next login
    - Login timestamp will be updated in the application layer after successful authentication
*/

-- Add last_login column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login timestamptz;
  END IF;
END $$;