/*
  # Add Order ID Field Name to Track & Trace Templates

  1. Changes
    - Add `order_id_field_name` column to `track_trace_templates` table
      - This specifies which field from the API response contains the order identifier
      - Used for navigation to shipment details page
      - This field does not need to be in the select fields/grid display
  
  2. Notes
    - Column is nullable to maintain backward compatibility
    - Should be set to the field name that contains the unique order identifier
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'track_trace_templates' 
    AND column_name = 'order_id_field_name'
  ) THEN
    ALTER TABLE track_trace_templates 
    ADD COLUMN order_id_field_name text;
  END IF;
END $$;