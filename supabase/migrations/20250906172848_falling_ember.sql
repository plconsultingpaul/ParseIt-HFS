/*
  # Create processed emails table

  1. New Tables
    - `processed_emails`
      - `id` (uuid, primary key)
      - `email_id` (text) - Microsoft Graph email ID
      - `sender` (text) - Email sender address
      - `subject` (text) - Email subject
      - `received_date` (timestamp) - When email was received
      - `processing_rule_id` (uuid) - Foreign key to email_processing_rules
      - `extraction_type_id` (uuid) - Foreign key to extraction_types
      - `pdf_filename` (text) - Name of processed PDF attachment
      - `processing_status` (text) - Status of processing
      - `error_message` (text) - Error message if processing failed
      - `parseit_id` (integer) - ID from ParseIt system
      - `processed_at` (timestamp) - When processing completed
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `processed_emails` table
    - Add policy for public access to processed emails

  3. Indexes
    - Add indexes for common query patterns
*/

CREATE TABLE IF NOT EXISTS processed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text NOT NULL,
  sender text NOT NULL,
  subject text NOT NULL,
  received_date timestamptz NOT NULL,
  processing_rule_id uuid,
  extraction_type_id uuid,
  pdf_filename text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending',
  error_message text,
  parseit_id integer,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE processed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to processed emails"
  ON processed_emails
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_processed_emails_email_id ON processed_emails (email_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_status ON processed_emails (processing_status);
CREATE INDEX IF NOT EXISTS idx_processed_emails_created_at ON processed_emails (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processed_emails_received_date ON processed_emails (received_date DESC);

-- Add foreign key constraints if the referenced tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_processing_rules') THEN
    ALTER TABLE processed_emails 
    ADD CONSTRAINT processed_emails_processing_rule_id_fkey 
    FOREIGN KEY (processing_rule_id) REFERENCES email_processing_rules(id) ON DELETE SET NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'extraction_types') THEN
    ALTER TABLE processed_emails 
    ADD CONSTRAINT processed_emails_extraction_type_id_fkey 
    FOREIGN KEY (extraction_type_id) REFERENCES extraction_types(id) ON DELETE SET NULL;
  END IF;
END $$;