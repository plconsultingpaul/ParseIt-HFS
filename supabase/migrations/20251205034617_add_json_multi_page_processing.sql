/*
  # Add JSON Multi-Page Processing Support

  1. Changes
    - Add `json_multi_page_processing` column to `extraction_types` table
    - Column allows enabling multi-page JSON processing where all pages from each PDF are processed together
    - Each PDF dropped will be treated as a separate processing group
    
  2. Details
    - Column type: boolean
    - Default value: false (maintains backward compatibility)
    - NOT NULL constraint
    - Enables processing multiple pages from the same PDF as a single JSON document
    
  3. Notes
    - When enabled, all pages from each individual PDF will be analyzed together
    - Each PDF is processed independently to produce one JSON output per PDF
    - Follows same pattern as existing csv_multi_page_processing feature
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'json_multi_page_processing'
  ) THEN
    ALTER TABLE extraction_types 
    ADD COLUMN json_multi_page_processing boolean NOT NULL DEFAULT false;
  END IF;
END $$;