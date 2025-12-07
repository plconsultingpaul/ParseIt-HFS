/*
  # Add Cross-Group Field Access Support

  ## Overview
  This migration enables any group to access field values extracted from previous groups
  in the same processing session. Fields from previous groups are made available with
  group prefixes (e.g., group1_bolNumber) for use in workflows and filename templates.

  ## New Tables
  - `extraction_group_data`
    - `id` (uuid, primary key) - Unique identifier for each group's extracted data
    - `session_id` (text, not null) - Links all groups processed together in one PDF transformation
    - `group_order` (integer, not null) - The order/number of the group (1, 2, 3, etc.)
    - `extraction_log_id` (uuid, nullable) - Reference to the extraction log for this group
    - `extracted_fields` (jsonb, not null) - The actual field values extracted from this group
    - `created_at` (timestamptz) - Timestamp when this data was stored

  ## Changes to Existing Tables
  - `extraction_logs`
    - Add `session_id` (text, nullable) - Links all groups in a multi-group transformation
    - Add `group_order` (integer, nullable) - Tracks which group configuration was used

  ## Security
  - Enable RLS on `extraction_group_data` table
  - Add policy for public access (controlled through application logic)

  ## Performance
  - Composite index on (session_id, group_order) for fast lookups
  - Index on created_at for cleanup operations

  ## Example Usage
  Group 1 (Invoice) extracts: {"bolNumber": "BOL12345", "invoiceDate": "2024-01-15"}
  Group 2 (Delivery Receipt) can access via: {{group1_bolNumber}} → "BOL12345"
*/

-- Create the extraction_group_data table
CREATE TABLE IF NOT EXISTS extraction_group_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  group_order integer NOT NULL,
  extraction_log_id uuid REFERENCES extraction_logs(id) ON DELETE SET NULL,
  extracted_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add session_id to extraction_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN session_id text;
    COMMENT ON COLUMN extraction_logs.session_id IS 'Session ID linking all groups processed together in a multi-group PDF transformation';
  END IF;
END $$;

-- Add group_order to extraction_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_logs' AND column_name = 'group_order'
  ) THEN
    ALTER TABLE extraction_logs ADD COLUMN group_order integer;
    COMMENT ON COLUMN extraction_logs.group_order IS 'The order/number of the group configuration used for this extraction (1, 2, 3, etc.)';
  END IF;
END $$;

-- Enable RLS on extraction_group_data
ALTER TABLE extraction_group_data ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for extraction_group_data (public access, controlled by application)
CREATE POLICY "Allow public access to extraction group data"
  ON extraction_group_data
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add composite index for fast session-based lookups
CREATE INDEX IF NOT EXISTS idx_extraction_group_data_session_group
  ON extraction_group_data(session_id, group_order);

-- Add index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_extraction_group_data_created_at
  ON extraction_group_data(created_at DESC);

-- Add index on extraction_logs for session queries
CREATE INDEX IF NOT EXISTS idx_extraction_logs_session_id
  ON extraction_logs(session_id)
  WHERE session_id IS NOT NULL;

-- Add index on extraction_logs for group order queries
CREATE INDEX IF NOT EXISTS idx_extraction_logs_group_order
  ON extraction_logs(group_order)
  WHERE group_order IS NOT NULL;

-- Add constraint to ensure group_order is positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'check_extraction_group_data_group_order_positive'
  ) THEN
    ALTER TABLE extraction_group_data
    ADD CONSTRAINT check_extraction_group_data_group_order_positive
    CHECK (group_order > 0);
  END IF;
END $$;

-- Add constraint to ensure unique session_id + group_order combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'unique_session_group_order'
  ) THEN
    ALTER TABLE extraction_group_data
    ADD CONSTRAINT unique_session_group_order
    UNIQUE (session_id, group_order);
  END IF;
END $$;