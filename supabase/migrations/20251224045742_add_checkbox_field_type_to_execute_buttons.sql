/*
  # Add Checkbox Field Type to Execute Button Fields

  1. Changes
    - Updates the CHECK constraint on `execute_button_fields.field_type` to include 'checkbox'
    
  2. Notes
    - Checkbox fields return "True" when checked and "False" when unchecked (Proper Case)
    - This is required for API compatibility
*/

ALTER TABLE execute_button_fields DROP CONSTRAINT IF EXISTS execute_button_fields_field_type_check;

ALTER TABLE execute_button_fields ADD CONSTRAINT execute_button_fields_field_type_check 
  CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'phone', 'zip', 'postal_code', 'province', 'state', 'dropdown', 'email', 'checkbox'));