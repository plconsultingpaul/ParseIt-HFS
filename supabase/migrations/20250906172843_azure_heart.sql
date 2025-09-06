/*
  # Create email processing rules table

  1. New Tables
    - `email_processing_rules`
      - `id` (uuid, primary key)
      - `rule_name` (text) - Name of the processing rule
      - `sender_pattern` (text) - Pattern to match sender email/name
      - `subject_pattern` (text) - Pattern to match email subject
      - `extraction_type_id` (uuid) - Foreign key to extraction_types
      - `is_enabled` (boolean) - Whether rule is active
      - `priority` (integer) - Rule priority (lower number = higher priority)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `email_processing_rules` table
    - Add policy for public access to email processing rules
*/

CREATE TABLE IF NOT EXISTS email_processing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  sender_pattern text DEFAULT '',
  subject_pattern text DEFAULT '',
  extraction_type_id uuid,
  is_enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_processing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to email processing rules"
  ON email_processing_rules
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add foreign key constraint to extraction_types if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extraction_types') THEN
    ALTER TABLE email_processing_rules 
    ADD CONSTRAINT email_processing_rules_extraction_type_id_fkey 
    FOREIGN KEY (extraction_type_id) REFERENCES extraction_types(id) ON DELETE SET NULL;
  END IF;
END $$;