/*
  # Add Array Group Support to Execute Button Groups

  1. Changes
    - Add `is_array_group` boolean column to `execute_button_groups` table
    - Add `array_min_rows` integer column for minimum number of rows
    - Add `array_max_rows` integer column for maximum number of rows  
    - Add `array_field_name` text column for the JSON field name used in API payloads

  2. Purpose
    - Allow groups to be configured as repeatable array groups
    - Users can add multiple rows of fields within a group
    - Data is collected as an array for API payloads

  3. Constraints
    - `array_min_rows` must be positive (>= 1)
    - `array_max_rows` must be >= `array_min_rows`
    - `array_field_name` is required when `is_array_group` is true
*/

ALTER TABLE execute_button_groups
ADD COLUMN IF NOT EXISTS is_array_group boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS array_min_rows integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS array_max_rows integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS array_field_name text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'execute_button_groups_array_min_rows_positive'
  ) THEN
    ALTER TABLE execute_button_groups
    ADD CONSTRAINT execute_button_groups_array_min_rows_positive
    CHECK (array_min_rows IS NULL OR array_min_rows >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'execute_button_groups_array_max_rows_valid'
  ) THEN
    ALTER TABLE execute_button_groups
    ADD CONSTRAINT execute_button_groups_array_max_rows_valid
    CHECK (array_max_rows IS NULL OR array_max_rows >= array_min_rows);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_execute_button_groups_is_array_group
ON execute_button_groups(is_array_group)
WHERE is_array_group = true;
