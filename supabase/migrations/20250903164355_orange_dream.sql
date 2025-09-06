/*
  # Create extraction logs table

  1. New Tables
    - `extraction_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `extraction_type_id` (uuid, foreign key to extraction_types)
      - `pdf_filename` (text)
      - `pdf_pages` (integer)
      - `extraction_status` (text - success/failed)
      - `error_message` (text, nullable)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `extraction_logs` table
    - Add policy for public access (since app handles auth)

  3. Indexes
    - Add indexes for common queries (user_id, extraction_type_id, created_at)
*/

CREATE TABLE IF NOT EXISTS extraction_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  extraction_type_id uuid REFERENCES extraction_types(id) ON DELETE SET NULL,
  pdf_filename text NOT NULL DEFAULT '',
  pdf_pages integer DEFAULT 0,
  extraction_status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE extraction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to extraction logs"
  ON extraction_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_extraction_logs_user_id ON extraction_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_extraction_type_id ON extraction_logs(extraction_type_id);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_created_at ON extraction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_status ON extraction_logs(extraction_status);