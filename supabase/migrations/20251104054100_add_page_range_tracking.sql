/*
  # Add Page Range Tracking to Extraction Logs

  ## Overview
  This migration adds page range tracking capabilities to the extraction_logs table,
  allowing users to see exactly which pages from the original PDF were used for each
  processed document/group.

  ## Changes to Tables
  - `extraction_logs`
    - Add `page_start` (integer, nullable) - Starting page number (1-indexed) from the original PDF
    - Add `page_end` (integer, nullable) - Ending page number (1-indexed) from the original PDF  
    - Add `page_ranges` (jsonb, nullable) - Detailed page range information for batch processing
    - Add `unused_pages` (integer, nullable) - Count of pages from original PDF that were not processed

  ## Important Notes
  1. page_start and page_end track the page range for single document processing
  2. page_ranges stores an array of page range objects for batch processing scenarios
  3. All page numbers are 1-indexed to match user expectations (page 1, page 2, etc.)
  4. unused_pages helps identify when parts of a PDF were not processed
  5. Nullable fields maintain backward compatibility with existing logs

  ## Example page_ranges JSON structure:
  [
    {"groupOrder": 1, "startPage": 1, "endPage": 1, "groupName": "Invoice"},
    {"groupOrder": 2, "startPage": 2, "endPage": 2, "groupName": "Packing Slip"}
  ]
*/

-- Add page_start column to track starting page of processed document
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'page_start'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN page_start integer;
    COMMENT ON COLUMN extraction_logs.page_start IS 'Starting page number (1-indexed) from the original PDF that was processed';
  END IF;
END $$;

-- Add page_end column to track ending page of processed document
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'page_end'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN page_end integer;
    COMMENT ON COLUMN extraction_logs.page_end IS 'Ending page number (1-indexed) from the original PDF that was processed';
  END IF;
END $$;

-- Add page_ranges column to store detailed page range information for batch processing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'page_ranges'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN page_ranges jsonb;
    COMMENT ON COLUMN extraction_logs.page_ranges IS 'Detailed page range information for batch processing. Array of objects with groupOrder, startPage, endPage, and groupName fields';
  END IF;
END $$;

-- Add unused_pages column to track pages that were not processed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'unused_pages'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN unused_pages integer;
    COMMENT ON COLUMN extraction_logs.unused_pages IS 'Count of pages from the original PDF that were not assigned to any group or processed';
  END IF;
END $$;

-- Add constraint to ensure page_start is positive if set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_page_start_positive'
  ) THEN
    ALTER TABLE extraction_logs
    ADD CONSTRAINT check_page_start_positive
    CHECK (page_start IS NULL OR page_start > 0);
  END IF;
END $$;

-- Add constraint to ensure page_end is positive if set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_page_end_positive'
  ) THEN
    ALTER TABLE extraction_logs
    ADD CONSTRAINT check_page_end_positive
    CHECK (page_end IS NULL OR page_end > 0);
  END IF;
END $$;

-- Add constraint to ensure page_end >= page_start if both are set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_page_range_valid'
  ) THEN
    ALTER TABLE extraction_logs
    ADD CONSTRAINT check_page_range_valid
    CHECK (
      (page_start IS NULL OR page_end IS NULL) OR 
      (page_end >= page_start)
    );
  END IF;
END $$;

-- Add constraint to ensure unused_pages is not negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_unused_pages_non_negative'
  ) THEN
    ALTER TABLE extraction_logs
    ADD CONSTRAINT check_unused_pages_non_negative
    CHECK (unused_pages IS NULL OR unused_pages >= 0);
  END IF;
END $$;

-- Create index for efficient page range queries
CREATE INDEX IF NOT EXISTS idx_extraction_logs_page_ranges 
  ON extraction_logs(page_start, page_end) 
  WHERE page_start IS NOT NULL AND page_end IS NOT NULL;