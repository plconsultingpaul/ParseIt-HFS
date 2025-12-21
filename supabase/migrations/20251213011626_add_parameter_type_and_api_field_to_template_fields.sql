/*
  # Add Parameter Type and API Field to Track Trace Template Fields

  1. Changes to `track_trace_template_fields` table
    - `parameter_type` (text) - Where the filter value is placed in the API request:
      - '$filter' - OData filter parameter
      - '$select' - OData select parameter  
      - '$orderBy' - OData order by parameter
      - 'query' - Standard query parameter
      - 'path' - Path variable
      - 'header' - Request header
      - 'body' - Request body
    - `api_field_path` (text) - The field path from the API spec for autocomplete/linking

  2. Notes
    - parameter_type defaults to '$filter' for filter fields
    - api_field_path is nullable since it can be manually entered
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'track_trace_template_fields' AND column_name = 'parameter_type'
  ) THEN
    ALTER TABLE track_trace_template_fields 
    ADD COLUMN parameter_type text NOT NULL DEFAULT 'query' 
    CHECK (parameter_type IN ('query', 'path', 'header', 'body', '$filter', '$select', '$orderBy'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'track_trace_template_fields' AND column_name = 'api_field_path'
  ) THEN
    ALTER TABLE track_trace_template_fields 
    ADD COLUMN api_field_path text;
  END IF;
END $$;