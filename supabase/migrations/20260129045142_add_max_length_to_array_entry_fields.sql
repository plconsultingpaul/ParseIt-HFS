/*
  # Add max_length column to extraction_type_array_entry_fields

  1. Changes
    - Adds `max_length` column to `extraction_type_array_entry_fields` table
    - This allows specifying maximum character length for string fields in array entries
    - Matches the existing field mapping functionality

  2. Column Details
    - `max_length` (integer, nullable) - Maximum character length for string data types
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_type_array_entry_fields' AND column_name = 'max_length'
  ) THEN
    ALTER TABLE extraction_type_array_entry_fields ADD COLUMN max_length integer;
  END IF;
END $$;