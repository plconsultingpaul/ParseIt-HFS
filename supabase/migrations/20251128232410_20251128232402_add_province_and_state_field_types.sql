/*
  # Add Province and State Field Types

  1. Changes
    - Updates the field_type CHECK constraint on order_entry_fields table
    - Adds 'province' and 'state' to the list of allowed field types
    - Maintains all existing field types: text, number, date, phone, dropdown, file, boolean, zip, postal_code
    
  2. Reason
    - Enables specialized dropdowns for Canadian provinces and US states
    - Province field stores 2-letter province codes (e.g., "BC", "ON")
    - State field stores 2-letter state codes (e.g., "WA", "CA")
    - Provides better user experience with searchable dropdowns showing full names
*/

-- Drop the existing constraint
ALTER TABLE order_entry_fields 
DROP CONSTRAINT IF EXISTS order_entry_fields_field_type_check;

-- Add the updated constraint with province and state included
ALTER TABLE order_entry_fields 
ADD CONSTRAINT order_entry_fields_field_type_check 
CHECK (field_type IN ('text', 'number', 'date', 'phone', 'dropdown', 'file', 'boolean', 'zip', 'postal_code', 'province', 'state'));
