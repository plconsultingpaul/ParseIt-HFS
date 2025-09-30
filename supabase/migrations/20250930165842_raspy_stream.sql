/*
  # Add current_zone column to users table

  1. Schema Changes
    - Add `current_zone` column to `users` table
      - Type: text
      - Nullable: true
      - Default: empty string

  2. Purpose
    - Store the current zone/location for vendor users
    - Used to filter orders in the Orders dashboard
    - Allows vendors to see only orders relevant to their zone
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'current_zone'
  ) THEN
    ALTER TABLE users ADD COLUMN current_zone text DEFAULT ''::text;
  END IF;
END $$;