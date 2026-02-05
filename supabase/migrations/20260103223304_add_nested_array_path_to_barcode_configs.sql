/*
  # Add Nested Array Path to Barcode Configs

  This migration adds support for flattening nested arrays while preserving parent fields
  in the barcode details section.

  1. Changes
    - Add `nested_array_path` column to `track_trace_barcode_configs` table
      - This specifies the field within each parent item that contains the child array
      - Example: If API returns details[] with each detail having a barcodes[] array,
        set response_array_path = "details" and nested_array_path = "barcodes"
      - The system will then flatten: each barcode row inherits parent detail fields

  2. Use Case
    - API response: { details: [{ commodity, description, barcodes: [{barcode, pcs, weight}] }] }
    - With nested_array_path = "barcodes", output becomes:
      - Row 1: { commodity, description, barcode, pcs, weight } (from detail[0].barcodes[0])
      - Row 2: { commodity, description, barcode, pcs, weight } (from detail[0].barcodes[1])
    - Field mappings can reference both parent and child fields
*/

ALTER TABLE track_trace_barcode_configs
ADD COLUMN IF NOT EXISTS nested_array_path text;

COMMENT ON COLUMN track_trace_barcode_configs.nested_array_path IS 'Field name within each parent item containing the nested array to flatten (e.g., "barcodes"). Each nested item inherits parent fields.';
