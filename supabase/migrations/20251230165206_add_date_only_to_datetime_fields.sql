/*
  # Add Date Only Option to DateTime Fields

  1. Changes
    - Adds `date_only` boolean column to `execute_button_fields` table
    - Adds `date_only` boolean column to `order_entry_fields` table
    - Adds `date_only` boolean column to `order_entry_template_fields` table
    - Default value is `false` (show both date and time)

  2. Purpose
    - When `date_only` is true, the DateTime field shows only a date picker (no time)
    - The value still includes time component as 00:00:00 for API compatibility
    - Provides flexibility for fields that only need date input but require timestamp format

  3. Affected Tables
    - `execute_button_fields` - Fields for Execute buttons
    - `order_entry_fields` - Global order entry configuration fields
    - `order_entry_template_fields` - Template-specific order entry fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execute_button_fields' AND column_name = 'date_only'
  ) THEN
    ALTER TABLE execute_button_fields ADD COLUMN date_only boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_entry_fields' AND column_name = 'date_only'
  ) THEN
    ALTER TABLE order_entry_fields ADD COLUMN date_only boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_entry_template_fields' AND column_name = 'date_only'
  ) THEN
    ALTER TABLE order_entry_template_fields ADD COLUMN date_only boolean DEFAULT false;
  END IF;
END $$;