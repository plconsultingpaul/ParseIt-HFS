/*
  # Add Dark Mode Setting to Driver Check-In

  1. Changes
    - Add `dark_mode_enabled` column to `driver_checkin_settings` table
      - Type: boolean
      - Default: false
      - Controls whether the driver check-in page displays in dark mode
  
  2. Purpose
    - Allows administrators to configure whether drivers see the check-in page in dark mode
    - Separate from the main application's dark mode setting
    - Provides better control over driver-facing interface appearance
*/

-- Add dark_mode_enabled column to driver_checkin_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'driver_checkin_settings' AND column_name = 'dark_mode_enabled'
  ) THEN
    ALTER TABLE driver_checkin_settings ADD COLUMN dark_mode_enabled boolean DEFAULT false;
  END IF;
END $$;