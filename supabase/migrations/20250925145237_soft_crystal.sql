/*
  # Add current_zone column to users table

  1. Schema Changes
    - Add `current_zone` column to `users` table
      - `current_zone` (text, nullable, default empty string)
      - Used to store the current zone/location for vendor users in the Orders dashboard

  2. Index
    - Add index on `current_zone` for efficient filtering

  3. Notes
    - This field is primarily used by vendor users to filter orders by their assigned zone
    - Administrators can set this value for users in User Management
*/

-- Add current_zone column to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'current_zone'
  ) THEN
    ALTER TABLE users ADD COLUMN current_zone text DEFAULT '' NOT NULL;
  END IF;
END $$;

-- Add index for efficient zone-based filtering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'users' AND indexname = 'idx_users_current_zone'
  ) THEN
    CREATE INDEX idx_users_current_zone ON users (current_zone);
  END IF;
END $$;