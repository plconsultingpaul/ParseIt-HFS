/*
  # Add Lock Upload Mode Feature

  1. New Columns
    - `lock_upload_mode` (boolean) - When enabled, users cannot change the upload mode on Transform/Extract pages

  2. Changes
    - Add `lock_upload_mode` column to `transformation_types` table (default: false)
    - Add `lock_upload_mode` column to `extraction_types` table (default: false)

  3. Purpose
    - Allow administrators to lock the upload mode for specific transformation/extraction types
    - Ensures consistent processing behavior when upload mode should not be user-selectable
    - Works in conjunction with `default_upload_mode` to enforce a specific upload mode
*/

-- Add lock_upload_mode to transformation_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transformation_types' AND column_name = 'lock_upload_mode'
  ) THEN
    ALTER TABLE transformation_types ADD COLUMN lock_upload_mode boolean DEFAULT false;
  END IF;
END $$;

-- Add lock_upload_mode to extraction_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'lock_upload_mode'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN lock_upload_mode boolean DEFAULT false;
  END IF;
END $$;
