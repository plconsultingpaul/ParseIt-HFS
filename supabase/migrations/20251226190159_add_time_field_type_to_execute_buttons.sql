/*
  # Add 24hr Time Field Type to Execute Button Fields

  1. Changes
    - Updates the CHECK constraint on `execute_button_fields.field_type` to include 'time'
    
  2. Notes
    - Time fields use 24hr format (HH:MM)
    - Useful for entering Open and Close times for clients
*/

ALTER TABLE execute_button_fields DROP CONSTRAINT IF EXISTS execute_button_fields_field_type_check;

ALTER TABLE execute_button_fields ADD CONSTRAINT execute_button_fields_field_type_check 
  CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'phone', 'zip', 'postal_code', 'province', 'state', 'dropdown', 'email', 'checkbox', 'time'));