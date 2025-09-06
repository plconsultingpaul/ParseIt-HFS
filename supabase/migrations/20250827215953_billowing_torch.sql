/*
  # Add Google API Key to API Settings

  1. Changes
    - Add `google_api_key` column to `api_settings` table
    - Column is text type with empty string default
    - Column is nullable for backward compatibility

  2. Security
    - No RLS changes needed (inherits existing policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_settings' AND column_name = 'google_api_key'
  ) THEN
    ALTER TABLE api_settings ADD COLUMN google_api_key text DEFAULT '' NOT NULL;
  END IF;
END $$;