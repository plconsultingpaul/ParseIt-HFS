/*
  # Add default_upload_mode to transformation_types table

  1. New Column
    - `default_upload_mode` (text) - Default upload mode for transformation type

  2. Purpose
    - Allow transformation types to specify a default upload mode ('manual' or 'auto')
    - Works with lock_upload_mode to control upload mode behavior
    - Matches the existing implementation in extraction_types table
*/

-- Add default_upload_mode to transformation_types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transformation_types' AND column_name = 'default_upload_mode'
  ) THEN
    ALTER TABLE transformation_types ADD COLUMN default_upload_mode text CHECK (default_upload_mode IN ('manual', 'auto'));
  END IF;
END $$;