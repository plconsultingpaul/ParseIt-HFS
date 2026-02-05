/*
  # Add Mapped Field Type to Array Entry Fields

  This migration adds 'mapped' as a valid field_type option for the
  extraction_type_array_entry_fields table. Mapped fields allow users to
  specify PDF coordinates to extract data from specific locations.

  1. Changes
    - Updates the field_type check constraint to include 'mapped'
    - Valid values: 'hardcoded', 'extracted', 'mapped'

  2. Purpose
    - Hardcoded: Static values that don't change
    - Extracted (AI): Values extracted using AI with natural language instructions
    - Mapped: Values extracted from specific PDF coordinates
*/

ALTER TABLE extraction_type_array_entry_fields
DROP CONSTRAINT IF EXISTS extraction_type_array_entry_fields_field_type_check;

ALTER TABLE extraction_type_array_entry_fields
ADD CONSTRAINT extraction_type_array_entry_fields_field_type_check
CHECK (field_type IN ('hardcoded', 'extracted', 'mapped'));