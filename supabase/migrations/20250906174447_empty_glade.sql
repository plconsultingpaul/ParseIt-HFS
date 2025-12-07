/*
  # Add user preferred upload mode column

  1. Schema Changes
    - Add `preferred_upload_mode` column to `users` table
    - Column type: text with check constraint for 'manual' or 'auto' values
    - Default value: 'manual'

  2. Security
    - No RLS changes needed (uses existing users table RLS)

  3. Notes
    - This allows each user to have their own default upload mode preference
    - Falls back to 'manual' if not set
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferred_upload_mode'
  ) THEN
    ALTER TABLE users ADD COLUMN preferred_upload_mode text DEFAULT 'manual';
    
    -- Add check constraint to ensure only valid values
    ALTER TABLE users ADD CONSTRAINT users_preferred_upload_mode_check 
      CHECK (preferred_upload_mode IN ('manual', 'auto'));
  END IF;
END $$;