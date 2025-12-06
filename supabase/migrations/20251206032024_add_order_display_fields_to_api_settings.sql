/*
  # Add Order Display Fields to API Settings

  1. Changes
    - Add `order_display_fields` column to `api_settings` table
    - Add `custom_order_display_fields` column to `api_settings` table
    - Columns are optional for backward compatibility
    - No RLS changes needed (inherits existing policies)

  2. Columns Added
    - order_display_fields: text field for comma-separated display fields
    - custom_order_display_fields: jsonb field for custom field configurations (stored as JSON array)

  3. Purpose
    - Fixes PGRST204 error: "Could not find the 'order_display_fields' column"
    - Aligns database schema with frontend code expectations
    - Enables order display configuration functionality
*/

DO $$
BEGIN
  -- Add order_display_fields column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_settings' AND column_name = 'order_display_fields'
  ) THEN
    ALTER TABLE api_settings ADD COLUMN order_display_fields text DEFAULT '' NOT NULL;
  END IF;

  -- Add custom_order_display_fields column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_settings' AND column_name = 'custom_order_display_fields'
  ) THEN
    ALTER TABLE api_settings ADD COLUMN custom_order_display_fields jsonb DEFAULT '[]'::jsonb NOT NULL;
  END IF;
END $$;