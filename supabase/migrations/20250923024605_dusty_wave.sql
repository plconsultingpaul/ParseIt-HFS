/*
  # Add custom order display fields column to api_settings table

  1. Schema Changes
    - Add `custom_order_display_fields` column to `api_settings` table
    - Column type: JSONB to store array of field name mappings
    - Default value: empty JSON array []
    - Nullable: true (optional field)

  2. Purpose
    - Allows administrators to customize field display names in the Orders dashboard
    - Stores mappings like {"fieldName": "consignee.address1", "displayLabel": "CONS_ADDRESS"}
    - Used by vendors to see user-friendly column headers in the Orders grid
*/

-- Add custom_order_display_fields column to api_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_settings' AND column_name = 'custom_order_display_fields'
  ) THEN
    ALTER TABLE api_settings ADD COLUMN custom_order_display_fields JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;