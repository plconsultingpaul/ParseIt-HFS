/*
  # Add Parameter Type and API Field Path to Track Trace Fields

  1. Changes to `track_trace_fields` table
    - `parameter_type` (text) - Where the filter value is placed in the API request:
      - 'query' - As a query parameter
      - 'path' - As a path variable
      - 'header' - As a request header
      - 'body' - In the request body (for POST requests)
    - `api_field_path` (text) - The field path from the API spec for autocomplete/linking

  2. Notes
    - parameter_type defaults to 'query' for backward compatibility
    - api_field_path is nullable since it can be manually entered
*/

-- Add parameter_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'track_trace_fields' AND column_name = 'parameter_type'
  ) THEN
    ALTER TABLE track_trace_fields 
    ADD COLUMN parameter_type text NOT NULL DEFAULT 'query' 
    CHECK (parameter_type IN ('query', 'path', 'header', 'body'));
  END IF;
END $$;

-- Add api_field_path column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'track_trace_fields' AND column_name = 'api_field_path'
  ) THEN
    ALTER TABLE track_trace_fields 
    ADD COLUMN api_field_path text;
  END IF;
END $$;
