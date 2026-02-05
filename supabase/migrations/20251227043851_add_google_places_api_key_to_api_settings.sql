/*
  # Add Google Places API Key to API Settings

  1. Changes
    - Add `google_places_api_key` column to `api_settings` table
    - This stores the Google Places API key for location lookup functionality

  2. Notes
    - Column is nullable to maintain backward compatibility
    - Used by the Execute Button flow designer for Google Places Lookup steps
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_settings' AND column_name = 'google_places_api_key'
  ) THEN
    ALTER TABLE api_settings ADD COLUMN google_places_api_key text;
  END IF;
END $$;