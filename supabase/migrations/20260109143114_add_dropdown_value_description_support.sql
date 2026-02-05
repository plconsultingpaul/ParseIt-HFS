/*
  # Add Dropdown Value/Description Support

  1. Changes
    - Add `dropdown_display_mode` column to `execute_button_fields` table
    - Values: 'description_only' (default) or 'value_and_description'
    - This controls how dropdown options are displayed to users

  2. Notes
    - The `options` column (JSONB) will now support objects with {value, description} format
    - Backward compatible - existing string arrays will continue to work
    - Display mode determines if user sees "Description" or "VALUE - Description"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execute_button_fields' AND column_name = 'dropdown_display_mode'
  ) THEN
    ALTER TABLE execute_button_fields 
    ADD COLUMN dropdown_display_mode text DEFAULT 'description_only' 
    CHECK (dropdown_display_mode IN ('description_only', 'value_and_description'));
  END IF;
END $$;