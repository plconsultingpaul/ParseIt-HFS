/*
  # Add Zip/Postal Code Combined Field Type

  1. Purpose
    - Add new 'zip_postal' field type that accepts both US Zip codes (5 digits) and Canadian Postal codes (A1A 1A1 format)
    - Provides flexibility for forms used by customers in both countries

  2. Changes
    - Updates order_entry_fields table to allow 'zip_postal' as a valid field_type
    - Updates order_entry_template_fields table to allow 'zip_postal' as a valid field_type

  3. Notes
    - Validation is handled at the application level (client-side)
    - US Zip: 5 digits (e.g., 92010)
    - Canadian Postal: A1A 1A1 format (e.g., V2R 4L7)
*/

-- Update the check constraint for order_entry_fields to include zip_postal
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'order_entry_fields_field_type_check' 
    AND table_name = 'order_entry_fields'
  ) THEN
    ALTER TABLE order_entry_fields DROP CONSTRAINT order_entry_fields_field_type_check;
  END IF;
END $$;

ALTER TABLE order_entry_fields 
ADD CONSTRAINT order_entry_fields_field_type_check 
CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'phone', 'dropdown', 'file', 'boolean', 'zip', 'postal_code', 'zip_postal', 'province', 'state'));

-- Update the check constraint for order_entry_template_fields to include zip_postal
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'order_entry_template_fields_field_type_check' 
    AND table_name = 'order_entry_template_fields'
  ) THEN
    ALTER TABLE order_entry_template_fields DROP CONSTRAINT order_entry_template_fields_field_type_check;
  END IF;
END $$;

ALTER TABLE order_entry_template_fields 
ADD CONSTRAINT order_entry_template_fields_field_type_check 
CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'phone', 'dropdown', 'file', 'boolean', 'zip', 'postal_code', 'zip_postal', 'province', 'state'));
