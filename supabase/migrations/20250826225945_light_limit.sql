/*
  # Add field_mappings column to extraction_types table

  1. Changes
    - Add `field_mappings` column to `extraction_types` table
    - Column stores JSON text containing field mapping configurations
    - Allows null values for backward compatibility

  2. Field Mappings Structure
    - Array of objects with fieldName, type, and value properties
    - Example: [{"fieldName": "orders[0].caller.name", "type": "mapped", "value": "Extract caller name"}]
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'field_mappings'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN field_mappings text;
  END IF;
END $$;