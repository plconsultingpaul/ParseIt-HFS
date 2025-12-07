/*
  # Add Zip and Postal Code Field Types

  1. Changes
    - Updates the field_type CHECK constraint on order_entry_fields table
    - Adds 'zip' and 'postal_code' to the list of allowed field types
    - Maintains all existing field types: text, number, date, phone, dropdown, file, boolean
    
  2. Reason
    - Application code already supports 'zip' and 'postal_code' field types
    - UI allows users to select these field types
    - Database constraint was missing these two types, causing save failures
*/

-- Drop the existing constraint
ALTER TABLE order_entry_fields 
DROP CONSTRAINT IF EXISTS order_entry_fields_field_type_check;

-- Add the updated constraint with zip and postal_code included
ALTER TABLE order_entry_fields 
ADD CONSTRAINT order_entry_fields_field_type_check 
CHECK (field_type IN ('text', 'number', 'date', 'phone', 'dropdown', 'file', 'boolean', 'zip', 'postal_code'));
