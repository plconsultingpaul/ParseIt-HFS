/*
  # Add is_required column to barcode fields

  1. Changes
    - Add `is_required` boolean column to `track_trace_barcode_fields` table
    - Default value is false
    - When true, rows with empty values for this field will be filtered out

  2. Purpose
    - Allows filtering barcode details to only show rows where required fields have values
    - Example: Only show rows where barcodes.barcode has a value
*/

ALTER TABLE track_trace_barcode_fields
ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT false;
