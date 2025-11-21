/*
  # Add Default Fallback Option to Array Split Configs

  1. Changes
    - Add `default_to_one_if_missing` column to `extraction_type_array_splits` table
    - Type: boolean
    - Default: false (maintains current behavior for existing configurations)
    - Not null: ensures consistent behavior
  
  2. Purpose
    - Allows configuration of fallback behavior when split field is missing, null, or 0
    - When enabled, creates 1 record instead of no records
    - When disabled, maintains current behavior (no records if field not found)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_type_array_splits' AND column_name = 'default_to_one_if_missing'
  ) THEN
    ALTER TABLE extraction_type_array_splits 
    ADD COLUMN default_to_one_if_missing boolean DEFAULT false NOT NULL;
  END IF;
END $$;