/*
  # Add Raw Form Data Column to Order Entry Submissions

  ## Summary
  This migration adds a `raw_form_data` column to track the original form data before
  field mapping transformations are applied, enabling troubleshooting of data flow issues.

  ## Changes
  1. New Columns
    - `raw_form_data` (jsonb) - Stores the original form values as entered by the user
      before any extraction type field mappings are applied

  ## Purpose
  - Enable debugging by comparing raw form input vs. mapped output
  - Track what data was originally submitted before transformations
  - Help identify issues in field mapping configurations

  ## Notes
  - Existing submissions will have NULL for raw_form_data
  - New submissions will store both raw_form_data and submission_data (mapped)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_entry_submissions' AND column_name = 'raw_form_data'
  ) THEN
    ALTER TABLE order_entry_submissions ADD COLUMN raw_form_data jsonb DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN order_entry_submissions.raw_form_data IS 'Original form data before field mapping transformations';
