/*
  # Add Order Entry Flag to Extraction Types

  1. Changes
    - Adds `is_order_entry` boolean column to `extraction_types` table
    - Defaults to `false` so existing types remain visible in Extract page
    - Types marked as Order Entry are intended for Order Entry processing only
    - These types will be filtered out of the Extract page dropdown

  2. Purpose
    - Allows extraction types to be designated specifically for Order Entry use
    - Extract page will only show types where is_order_entry is false
    - Provides clear separation between manual extraction and Order Entry types
*/

ALTER TABLE extraction_types
ADD COLUMN IF NOT EXISTS is_order_entry boolean DEFAULT false;

COMMENT ON COLUMN extraction_types.is_order_entry IS 'When true, this extraction type is intended for Order Entry use only and will not appear in the Extract page dropdown';
