/*
  # Add CSV Format Support to Extraction Types

  1. Changes to extraction_types table
    - Add CSV-specific configuration columns:
      - `csv_delimiter` (text, default ',') - Delimiter character for CSV output
      - `csv_include_headers` (boolean, default true) - Whether to include header row in CSV
      - `csv_row_detection_instructions` (text) - AI instructions for identifying rows in PDF
    
  2. Notes
    - The existing `format_type` column will now support 'CSV' alongside 'XML' and 'JSON'
    - The existing `field_mappings` column will be used to define CSV columns
    - CSV format types will use the same field mapping structure as JSON/XML types
    - Row detection instructions help AI identify what constitutes a new row (e.g., "Each Carrier Reference 1 field creates a new row")
*/

-- Add csv_delimiter column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'csv_delimiter'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN csv_delimiter text DEFAULT ',';
  END IF;
END $$;

-- Add csv_include_headers column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'csv_include_headers'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN csv_include_headers boolean DEFAULT true;
  END IF;
END $$;

-- Add csv_row_detection_instructions column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'csv_row_detection_instructions'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN csv_row_detection_instructions text;
  END IF;
END $$;