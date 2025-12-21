/*
  # Add Value Mappings to Track & Trace Template Fields

  1. Changes
    - Add `value_mappings` JSONB column to `track_trace_template_fields` table
    - This column stores an array of source -> display value transformations
    - Example: [{"sourceValue": "AVAIL", "displayValue": "PENDING"}, ...]

  2. Purpose
    - Allows administrators to configure display value transformations for result columns
    - Raw API values can be mapped to user-friendly display values
    - Multiple source values can map to the same display value

  3. Schema
    - value_mappings: JSONB array, nullable, defaults to empty array
    - Each entry has: sourceValue (string) and displayValue (string)
*/

ALTER TABLE track_trace_template_fields
ADD COLUMN IF NOT EXISTS value_mappings jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN track_trace_template_fields.value_mappings IS 'Array of value mapping rules: [{"sourceValue": "API_VALUE", "displayValue": "Display Value"}, ...]';
