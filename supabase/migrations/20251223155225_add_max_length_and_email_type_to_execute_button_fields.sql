/*
  # Add Max Length and Email Type to Execute Button Fields

  1. Changes
    - Add `max_length` column to `execute_button_fields` table (nullable integer)
    - Update `field_type` check constraint to include 'email' type

  2. Purpose
    - Allow setting maximum character length for text fields
    - Add email field type with validation support
*/

-- Add max_length column to execute_button_fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execute_button_fields' AND column_name = 'max_length'
  ) THEN
    ALTER TABLE execute_button_fields ADD COLUMN max_length integer;
  END IF;
END $$;

-- Update field_type check constraint to include 'email'
ALTER TABLE execute_button_fields DROP CONSTRAINT IF EXISTS execute_button_fields_field_type_check;

ALTER TABLE execute_button_fields ADD CONSTRAINT execute_button_fields_field_type_check 
  CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'phone', 'zip', 'postal_code', 'province', 'state', 'dropdown', 'email'));