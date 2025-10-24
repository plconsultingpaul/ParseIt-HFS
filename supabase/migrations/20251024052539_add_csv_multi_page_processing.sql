/*
  # Add CSV Multi-Page Processing Support

  1. Changes
    - Add `csv_multi_page_processing` column to `extraction_types` table
      - Boolean field to indicate if all pages should be processed as one CSV
      - Defaults to false for backward compatibility
      - Only applies when format_type is 'CSV'
  
  2. Notes
    - This enhancement allows users to combine data from multiple PDF pages into a single CSV file
    - Maintains backward compatibility with existing extraction types
    - When enabled, all pages in a multi-page PDF will be processed together and output as one CSV
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'csv_multi_page_processing'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN csv_multi_page_processing boolean DEFAULT false;
  END IF;
END $$;