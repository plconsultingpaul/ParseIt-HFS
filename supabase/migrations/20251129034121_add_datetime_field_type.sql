/*
  # Add DateTime Field Type

  1. Changes
    - Updates the field_type CHECK constraint on order_entry_fields table
    - Adds 'datetime' to the list of allowed field types
    - Maintains all existing field types: text, number, date, phone, dropdown, file, boolean, zip, postal_code, province, state
    
  2. Reason
    - Enables support for DB2 Timestamp fields that require both date and time selection
    - Distinguishes from the existing 'date' type which only captures dates
    - Provides datetime-local HTML5 input for combined date/time entry
*/

-- Drop the existing constraint
ALTER TABLE order_entry_fields 
DROP CONSTRAINT IF EXISTS order_entry_fields_field_type_check;

-- Add the updated constraint with datetime included
ALTER TABLE order_entry_fields 
ADD CONSTRAINT order_entry_fields_field_type_check 
CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'phone', 'dropdown', 'file', 'boolean', 'zip', 'postal_code', 'province', 'state'));
