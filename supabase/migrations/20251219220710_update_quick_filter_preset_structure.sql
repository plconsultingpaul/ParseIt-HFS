/*
  # Update Quick Filter Preset Structure
  
  1. Changes
    - Drop `track_trace_filter_preset_default_fields` table (not needed)
    - Update filter_values structure to store operator + value
  
  2. New Filter Values Structure
    - Old: { "fieldName": "value" }
    - New: { "fieldName": { "operator": "eq", "value": "12345" } }
    - Supported operators: eq, ne, gt, lt, ge, le, in, not in, contains, startswith, endswith
  
  3. Notes
    - All filter values go into $filter parameter (OData format)
    - Parameter Type is always "filter" so it's not stored per field
*/

-- Drop the default fields table (not needed for this approach)
DROP TABLE IF EXISTS track_trace_filter_preset_default_fields CASCADE;

-- Add comment to clarify the updated filter_values structure
COMMENT ON COLUMN track_trace_filter_presets.filter_values IS 
  'JSONB structure: { "fieldName": { "operator": "eq|ne|gt|lt|ge|le|in|not in|contains|startswith|endswith", "value": "..." } }';
