/*
  # Add ParseIt ID and Trace Type mapping columns

  1. Schema Changes
    - Add `trace_type_mapping` column to extraction_types table
    - Add `trace_type_value` column to extraction_types table
  
  2. Purpose
    - Allow users to specify where trace type should be placed in JSON
    - Allow users to specify what value the trace type should have
    - Works alongside existing parseit_id_mapping for complete trace number configuration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'trace_type_mapping'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN trace_type_mapping text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'trace_type_value'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN trace_type_value text;
  END IF;
END $$;