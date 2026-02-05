/*
  # Add Extraction Type Tracking to Order Entry Submissions

  1. Changes
    - Adds `extraction_type_id` column to `order_entry_submissions` table
    - Creates foreign key reference to `extraction_types` table
    - Adds index for efficient querying by extraction type

  2. Purpose
    - Track which extraction type configuration was used for each submission
    - Enable filtering/grouping submissions by extraction type
    - Provide visibility into the extraction type used in submission detail views
*/

-- Add extraction_type_id column to order_entry_submissions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_entry_submissions' AND column_name = 'extraction_type_id'
  ) THEN
    ALTER TABLE order_entry_submissions 
    ADD COLUMN extraction_type_id uuid REFERENCES extraction_types(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_order_entry_submissions_extraction_type 
ON order_entry_submissions(extraction_type_id);