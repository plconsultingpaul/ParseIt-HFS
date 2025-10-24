/*
  # Add CSV Path to SFTP Configuration

  1. Changes to sftp_config table
    - Add `csv_path` column for CSV file uploads
    - Default value: '/uploads/csv/'
    
  2. Notes
    - This allows SFTP upload workflow steps to specify where CSV files should be uploaded
    - Complements existing xml_path, json_path, and pdf_path columns
*/

-- Add csv_path column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sftp_config' AND column_name = 'csv_path'
  ) THEN
    ALTER TABLE sftp_config ADD COLUMN csv_path text DEFAULT '/uploads/csv/';
  END IF;
END $$;