/*
  # Add Page Processing Options to Extraction Types

  1. Changes
    - Add `page_processing_mode` column to extraction_types
      - Values: 'all', 'single', 'range'
      - Default: 'all' (current behavior)
    - Add `page_processing_single_page` column
      - Stores which page number when mode is 'single'
      - Default: 1
    - Add `page_processing_range_start` column
      - Stores start page when mode is 'range'
      - Default: 1
    - Add `page_processing_range_end` column
      - Stores end page when mode is 'range'
      - Default: 1

  2. Purpose
    - Allow users to configure which pages to extract from each PDF
    - Single Page: Extract only a specific page from each PDF (e.g., page 1)
    - Page Range: Extract a range of pages from each PDF (e.g., pages 1-2)
    - All Pages: Extract all pages (default, current behavior)

  3. Important Note
    - Page filtering applies per individual PDF file
    - Example: If 2 PDFs are uploaded with "Single Page: 1" selected,
      page 1 from EACH PDF will be extracted (2 pages total)
*/

-- Add page processing mode column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'page_processing_mode'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN page_processing_mode text DEFAULT 'all';
  END IF;
END $$;

-- Add single page number column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'page_processing_single_page'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN page_processing_single_page integer DEFAULT 1;
  END IF;
END $$;

-- Add range start column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'page_processing_range_start'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN page_processing_range_start integer DEFAULT 1;
  END IF;
END $$;

-- Add range end column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'page_processing_range_end'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN page_processing_range_end integer DEFAULT 1;
  END IF;
END $$;

-- Add check constraint to ensure valid mode values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'extraction_types_page_processing_mode_check'
  ) THEN
    ALTER TABLE extraction_types 
    ADD CONSTRAINT extraction_types_page_processing_mode_check 
    CHECK (page_processing_mode IN ('all', 'single', 'range'));
  END IF;
END $$;

-- Add check constraint to ensure positive page numbers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'extraction_types_page_processing_single_page_check'
  ) THEN
    ALTER TABLE extraction_types 
    ADD CONSTRAINT extraction_types_page_processing_single_page_check 
    CHECK (page_processing_single_page >= 1);
  END IF;
END $$;

-- Add check constraint to ensure positive range start
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'extraction_types_page_processing_range_start_check'
  ) THEN
    ALTER TABLE extraction_types 
    ADD CONSTRAINT extraction_types_page_processing_range_start_check 
    CHECK (page_processing_range_start >= 1);
  END IF;
END $$;

-- Add check constraint to ensure range end >= range start
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'extraction_types_page_processing_range_end_check'
  ) THEN
    ALTER TABLE extraction_types 
    ADD CONSTRAINT extraction_types_page_processing_range_end_check 
    CHECK (page_processing_range_end >= page_processing_range_start);
  END IF;
END $$;