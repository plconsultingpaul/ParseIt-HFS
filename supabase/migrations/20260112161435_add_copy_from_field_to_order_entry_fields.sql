/*
  # Add Copy From Field to Order Entry Fields
  
  1. Changes
    - Add `copy_from_field` column to `order_entry_fields` table
    - This allows configuring a field to auto-populate from another field's value
    - Example: "Pickup End" copies from "Pickup Start" when user fills it in
  
  2. Column Details
    - `copy_from_field` (text, nullable) - The field name to copy the value from
*/

ALTER TABLE order_entry_fields 
ADD COLUMN IF NOT EXISTS copy_from_field text;

COMMENT ON COLUMN order_entry_fields.copy_from_field IS 'Field name to copy value from when that field is populated';
