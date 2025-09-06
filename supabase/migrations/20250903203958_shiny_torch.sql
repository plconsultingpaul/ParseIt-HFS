/*
  # Add API response logging to extraction logs

  1. Schema Changes
    - Add `api_response` column to `extraction_logs` table to store JSON API responses
    - Add `api_status_code` column to track HTTP status codes
    - Add `api_error` column to store API error messages

  2. Purpose
    - Store API responses for JSON extraction types
    - Allow users to view what was returned from API calls
    - Track API success/failure status separately from extraction status
*/

-- Add API response columns to extraction_logs table
DO $$
BEGIN
  -- Add api_response column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'api_response'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN api_response text;
  END IF;

  -- Add api_status_code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'api_status_code'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN api_status_code integer;
  END IF;

  -- Add api_error column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'api_error'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN api_error text;
  END IF;
END $$;