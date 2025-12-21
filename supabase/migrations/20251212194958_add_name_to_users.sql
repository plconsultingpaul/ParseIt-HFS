/*
  # Add Name Field to Users Table

  1. Changes
    - Add `name` column to `users` table to store user's display name
    - Column is nullable to support existing users
    - Name field will be used in email templates and UI display

  2. Purpose
    - Enable personalized greetings using name instead of username
    - Improve user experience with friendly display names
    - Support email templates with {{name}} variable
*/

-- Add name column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'name'
  ) THEN
    ALTER TABLE users ADD COLUMN name text;
  END IF;
END $$;