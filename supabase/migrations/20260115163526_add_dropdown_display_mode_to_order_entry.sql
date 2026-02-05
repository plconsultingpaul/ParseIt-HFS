/*
  # Add Dropdown Display Mode to Order Entry Fields

  1. Changes
    - Adds `dropdown_display_mode` column to `order_entry_fields` table
    - Adds `dropdown_display_mode` column to `order_entry_template_fields` table
    - Values: 'description_only' (default) or 'value_and_description'
    - This controls how dropdown options are displayed to users

  2. Purpose
    - Allows dropdown fields to have separate values (sent to API) and descriptions (shown to users)
    - Matches the functionality already available in Execute Button fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_entry_fields' AND column_name = 'dropdown_display_mode'
  ) THEN
    ALTER TABLE order_entry_fields 
    ADD COLUMN dropdown_display_mode text DEFAULT 'description_only' 
    CHECK (dropdown_display_mode IN ('description_only', 'value_and_description'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_entry_template_fields' AND column_name = 'dropdown_display_mode'
  ) THEN
    ALTER TABLE order_entry_template_fields 
    ADD COLUMN dropdown_display_mode text DEFAULT 'description_only' 
    CHECK (dropdown_display_mode IN ('description_only', 'value_and_description'));
  END IF;
END $$;