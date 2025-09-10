/*
  # Add Auto-Detection Instructions to Extraction Types

  1. Schema Changes
    - Add `auto_detect_instructions` column to `extraction_types` table
    - This column will store AI instructions for automatic document type detection

  2. Purpose
    - Enable AI-powered automatic detection of extraction types based on PDF content
    - Allow users to define specific criteria for each extraction type
    - Improve user experience by reducing manual type selection
*/

-- Add auto_detect_instructions column to extraction_types table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'auto_detect_instructions'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN auto_detect_instructions text DEFAULT NULL;
  END IF;
END $$;