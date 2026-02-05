/*
  # Add Field Grouping Support to Barcode Details

  1. Changes to `track_trace_barcode_fields`
    - `group_id` (text, nullable) - Fields with matching group_id combine into one column
    - `group_separator` (text, nullable) - Separator between grouped values (e.g., ' x ')
    - `value_suffix` (text, nullable) - Suffix appended to each value (e.g., '"' for inches)

  2. Use Case Examples
    - Weight + Unit: group_id='weight', separator=' ' → "650 lbs"
    - Length + Width + Height: group_id='dimensions', separator=' x ', suffix='"' → "40" x 48" x 48""
    - Cube + Unit: group_id='cube', separator=' ' → "96 ft³"

  3. Notes
    - First field in a group determines the column header label
    - Fields are combined in display_order sequence
    - Non-grouped fields render normally (group_id = null)
*/

ALTER TABLE track_trace_barcode_fields
ADD COLUMN IF NOT EXISTS group_id text,
ADD COLUMN IF NOT EXISTS group_separator text,
ADD COLUMN IF NOT EXISTS value_suffix text;

COMMENT ON COLUMN track_trace_barcode_fields.group_id IS 'Fields with matching group_id are combined into a single column';
COMMENT ON COLUMN track_trace_barcode_fields.group_separator IS 'Separator between grouped field values (e.g., " x ")';
COMMENT ON COLUMN track_trace_barcode_fields.value_suffix IS 'Suffix appended to each field value (e.g., ''"'' for inches)';