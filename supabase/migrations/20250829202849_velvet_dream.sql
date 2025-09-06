/*
  # Add json_path column to sftp_config table

  1. Changes
    - Add `json_path` column to `sftp_config` table
    - Set default value to '/uploads/json/'
    - Allow null values for backward compatibility

  2. Purpose
    - Enable separate JSON file upload path configuration
    - Support different directories for JSON vs XML files
    - Maintain backward compatibility with existing records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sftp_config' AND column_name = 'json_path'
  ) THEN
    ALTER TABLE sftp_config ADD COLUMN json_path text DEFAULT '/uploads/json/';
  END IF;
END $$;