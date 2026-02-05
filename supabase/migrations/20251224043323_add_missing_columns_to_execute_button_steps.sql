/*
  # Add Missing Columns to Execute Button Steps

  1. Problem
    - The execute_button_steps table is missing two columns that were supposed to be created:
      - `escape_single_quotes_in_body` (boolean) - for API calls
      - `is_enabled` (boolean) - allows disabling steps without deletion
    - This causes PGRST204 errors when trying to insert/update steps

  2. Fix
    - Add the missing columns with proper defaults
    - Use IF NOT EXISTS logic to prevent errors if columns exist

  3. Notes
    - These columns were defined in the original migration but don't exist in the database
    - This migration safely adds them with appropriate defaults
*/

-- Add escape_single_quotes_in_body column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execute_button_steps' AND column_name = 'escape_single_quotes_in_body'
  ) THEN
    ALTER TABLE execute_button_steps ADD COLUMN escape_single_quotes_in_body boolean DEFAULT false;
  END IF;
END $$;

-- Add is_enabled column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execute_button_steps' AND column_name = 'is_enabled'
  ) THEN
    ALTER TABLE execute_button_steps ADD COLUMN is_enabled boolean DEFAULT true;
  END IF;
END $$;
