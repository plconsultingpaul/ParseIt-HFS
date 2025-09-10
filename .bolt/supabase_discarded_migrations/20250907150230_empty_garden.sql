/*
  # Create email polling logs table

  1. New Tables
    - `email_polling_logs`
      - `id` (uuid, primary key)
      - `timestamp` (timestamp with time zone)
      - `provider` (text - office365 or gmail)
      - `status` (text - success, failed, or running)
      - `emails_found` (integer)
      - `emails_processed` (integer)
      - `error_message` (text, nullable)
      - `execution_time_ms` (integer, nullable)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `email_polling_logs` table
    - Add policy for public access to polling logs
*/

CREATE TABLE IF NOT EXISTS email_polling_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  provider text NOT NULL DEFAULT 'office365',
  status text NOT NULL DEFAULT 'running',
  emails_found integer DEFAULT 0,
  emails_processed integer DEFAULT 0,
  error_message text,
  execution_time_ms integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_polling_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to email polling logs"
  ON email_polling_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_email_polling_logs_timestamp 
  ON email_polling_logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_email_polling_logs_status 
  ON email_polling_logs (status);

-- Add constraint for status values
ALTER TABLE email_polling_logs 
ADD CONSTRAINT email_polling_logs_status_check 
CHECK (status IN ('running', 'success', 'failed'));

-- Add constraint for provider values
ALTER TABLE email_polling_logs 
ADD CONSTRAINT email_polling_logs_provider_check 
CHECK (provider IN ('office365', 'gmail'));