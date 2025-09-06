/*
  # Add extracted data column to extraction logs

  1. Schema Changes
    - Add `extracted_data` column to `extraction_logs` table to store the extracted JSON/XML data
    - This allows users to view what was extracted from the PDF before it was sent to the API

  2. Purpose
    - Store the raw extracted data for debugging and review
    - Allow users to see exactly what the AI extracted from their PDFs
    - Useful for troubleshooting extraction accuracy
*/

-- Add extracted_data column to store the extracted JSON/XML content
ALTER TABLE extraction_logs 
ADD COLUMN IF NOT EXISTS extracted_data text;

-- Add comment to document the new column
COMMENT ON COLUMN extraction_logs.extracted_data IS 'Stores the extracted JSON/XML data from the PDF before API submission';