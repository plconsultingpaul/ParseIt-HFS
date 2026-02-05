/*
  # Add remove_if_null Column to Array Entry Fields

  1. Changes
    - Adds `remove_if_null` boolean column to `extraction_type_array_entry_fields` table
    - Default value is `false` to maintain backward compatibility
    - This allows array entry fields to be removed from the final output when their value is null/empty

  2. Column Details
    - `remove_if_null` (boolean, default false) - When true, removes the field from the array entry if value is null, empty, or undefined

  3. Use Case
    - Matches the existing "RIN" (Remove if Null) functionality in Field Mappings
    - Allows cleaner JSON output by omitting fields with no meaningful data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_type_array_entry_fields' AND column_name = 'remove_if_null'
  ) THEN
    ALTER TABLE extraction_type_array_entry_fields ADD COLUMN remove_if_null boolean DEFAULT false;
  END IF;
END $$;