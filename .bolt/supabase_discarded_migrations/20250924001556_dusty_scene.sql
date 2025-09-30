/*
  # Add PDF grouping columns to transformation_types table

  1. New Columns
    - `pages_per_group` (integer) - Number of pages to group together (default: 1)
    - `document_start_pattern` (text) - Pattern to detect document start
    - `document_start_detection_enabled` (boolean) - Enable pattern-based detection (default: false)

  2. Purpose
    - Enable advanced PDF splitting and grouping functionality
    - Support pattern-based document boundary detection
    - Allow transformation types to specify how PDFs should be split
*/

-- Add pages_per_group column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transformation_types' AND column_name = 'pages_per_group'
  ) THEN
    ALTER TABLE transformation_types ADD COLUMN pages_per_group integer DEFAULT 1;
  END IF;
END $$;

-- Add document_start_pattern column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transformation_types' AND column_name = 'document_start_pattern'
  ) THEN
    ALTER TABLE transformation_types ADD COLUMN document_start_pattern text;
  END IF;
END $$;

-- Add document_start_detection_enabled column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transformation_types' AND column_name = 'document_start_detection_enabled'
  ) THEN
    ALTER TABLE transformation_types ADD COLUMN document_start_detection_enabled boolean DEFAULT false;
  END IF;
END $$;