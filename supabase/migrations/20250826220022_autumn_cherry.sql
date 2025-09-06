/*
  # Add JSON format fields to extraction_types table

  1. New Columns
    - `format_type` (text, default 'XML') - Whether to use XML or JSON format
    - `json_path` (text, nullable) - API path to append when using JSON format

  2. Changes
    - Add format_type column with default value 'XML'
    - Add json_path column for JSON API endpoints
    - Update existing records to have format_type = 'XML'
*/

-- Add format_type column with default 'XML'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'format_type'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN format_type text DEFAULT 'XML';
  END IF;
END $$;

-- Add json_path column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'json_path'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN json_path text;
  END IF;
END $$;

-- Update existing records to have format_type = 'XML'
UPDATE extraction_types SET format_type = 'XML' WHERE format_type IS NULL;