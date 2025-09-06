/*
  # Add filename field and ParseIt_ID sequence

  1. New Features
    - Add `filename` column to `extraction_types` table for custom file naming
    - Create `parseit_id_seq` sequence starting from 1 for unique file numbering
    - Add function to get next ParseIt_ID value

  2. Changes
    - `extraction_types` table gets new `filename` column (text, default empty string)
    - New sequence `parseit_id_seq` for auto-incrementing ParseIt_ID
    - Helper function `get_next_parseit_id()` to retrieve next sequence value

  3. Security
    - No RLS changes needed as this extends existing table structure
*/

-- Add filename column to extraction_types table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_types' AND column_name = 'filename'
  ) THEN
    ALTER TABLE extraction_types ADD COLUMN filename text DEFAULT '' NOT NULL;
  END IF;
END $$;

-- Create sequence for ParseIt_ID starting from 1
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.sequences
    WHERE sequence_name = 'parseit_id_seq'
  ) THEN
    CREATE SEQUENCE parseit_id_seq START WITH 1 INCREMENT BY 1;
  END IF;
END $$;

-- Create function to get next ParseIt_ID
CREATE OR REPLACE FUNCTION get_next_parseit_id()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  SELECT nextval('parseit_id_seq')::INTEGER;
$$;