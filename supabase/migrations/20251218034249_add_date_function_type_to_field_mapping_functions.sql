/*
  # Add Date Function Type Support

  1. Changes
    - Add `function_type` column to `field_mapping_functions` table
    - Default value is 'conditional' for backwards compatibility with existing IF/THEN functions
    - New 'date' type allows date calculations (add/subtract days from field or current date)

  2. Function Types
    - 'conditional': Existing IF/THEN logic with conditions and default value
    - 'date': Date calculation with source (field/current_date), operation (add/subtract), and days
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'field_mapping_functions' AND column_name = 'function_type'
  ) THEN
    ALTER TABLE field_mapping_functions 
    ADD COLUMN function_type text NOT NULL DEFAULT 'conditional';
  END IF;
END $$;

COMMENT ON COLUMN field_mapping_functions.function_type IS 'Type of function: conditional (IF/THEN logic) or date (date calculations)';