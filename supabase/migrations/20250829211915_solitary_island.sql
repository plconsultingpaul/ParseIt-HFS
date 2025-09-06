/*
  # Add ParseIt ID Mapping column to extraction_types table

  1. New Column
    - `parseit_id_mapping` (text, nullable)
      - Stores the JSON field path where ParseIt ID should be injected
      - Examples: "parseitId", "order.id", "metadata.parseitId"

  2. Purpose
    - Allows users to specify where in their JSON structure the ParseIt ID should be placed
    - Enables automatic injection of ParseIt ID into API calls
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'parseit_id_mapping'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN parseit_id_mapping text;
  END IF;
END $$;