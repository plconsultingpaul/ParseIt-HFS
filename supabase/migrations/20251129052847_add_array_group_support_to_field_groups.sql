/*
  # Add Array Group Support to Field Groups

  ## Overview
  This migration adds support for Field Groups to be configured as array groups,
  where all fields within the group become columns in a multi-row table.

  ## Changes
  
  1. New Columns in order_entry_field_groups
    - `is_array_group` (boolean, default: false) - Marks if this group is an array
    - `array_min_rows` (integer, default: 1) - Minimum number of rows required
    - `array_max_rows` (integer, default: 10) - Maximum number of rows allowed
    - `array_json_path` (text) - Common JSON path for all fields in the array (e.g., "orders[details][]")

  ## Important Notes
  - Existing field groups will have is_array_group = false by default
  - Array group settings only apply when is_array_group = true
  - All fields within an array group should share the same array JSON path
*/

-- Add array group support columns to order_entry_field_groups
ALTER TABLE order_entry_field_groups
ADD COLUMN IF NOT EXISTS is_array_group boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS array_min_rows integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS array_max_rows integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS array_json_path text;

-- Add constraint to ensure array_min_rows is positive
ALTER TABLE order_entry_field_groups
ADD CONSTRAINT order_entry_field_groups_array_min_rows_positive
CHECK (array_min_rows IS NULL OR array_min_rows > 0);

-- Add constraint to ensure array_max_rows is greater than or equal to array_min_rows
ALTER TABLE order_entry_field_groups
ADD CONSTRAINT order_entry_field_groups_array_max_rows_valid
CHECK (array_max_rows IS NULL OR array_max_rows >= COALESCE(array_min_rows, 1));

-- Add constraint to ensure array_json_path is provided when is_array_group is true
ALTER TABLE order_entry_field_groups
ADD CONSTRAINT order_entry_field_groups_array_json_path_required
CHECK (
  (is_array_group = false) OR 
  (is_array_group = true AND array_json_path IS NOT NULL AND array_json_path != '')
);

-- Create index for array groups for faster queries
CREATE INDEX IF NOT EXISTS idx_order_entry_field_groups_is_array_group 
ON order_entry_field_groups(is_array_group) 
WHERE is_array_group = true;
