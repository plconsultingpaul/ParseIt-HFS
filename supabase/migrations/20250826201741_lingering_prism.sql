/*
  # Add PDF path column to SFTP configuration

  1. Changes
    - Add `pdf_path` column to `sftp_config` table
    - Set default value to '/uploads/pdf/' for consistency
    - Make column nullable to handle existing records gracefully

  2. Notes
    - Existing records will get the default PDF path
    - This allows separate configuration of XML and PDF upload paths
*/

-- Add pdf_path column to sftp_config table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sftp_config' AND column_name = 'pdf_path'
  ) THEN
    ALTER TABLE sftp_config ADD COLUMN pdf_path text DEFAULT '/uploads/pdf/';
  END IF;
END $$;