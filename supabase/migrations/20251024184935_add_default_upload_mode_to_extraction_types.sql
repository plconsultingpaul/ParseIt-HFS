/*
  # Add Default Upload Mode to Extraction Types

  1. Changes
    - Add `default_upload_mode` column to `extraction_types` table
      - Text field to specify default upload mode ('manual' or 'auto')
      - Nullable to maintain backward compatibility
      - When set, the Extract screen will automatically default to this upload mode when the extraction type is selected

  2. Notes
    - This enhancement allows each extraction type to have its preferred upload mode
    - Existing extraction types will continue to work (NULL means no default preference)
    - Users can still manually change the upload mode after selection
    - Vendor role restrictions (always auto mode) remain enforced regardless of this setting
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'default_upload_mode'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN default_upload_mode text;
  END IF;
END $$;