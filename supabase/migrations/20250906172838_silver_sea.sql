/*
  # Create email monitoring configuration table

  1. New Tables
    - `email_monitoring_config`
      - `id` (uuid, primary key)
      - `tenant_id` (text) - Microsoft 365 tenant ID
      - `client_id` (text) - Application client ID
      - `client_secret` (text) - Application client secret
      - `monitored_email` (text) - Email address to monitor
      - `polling_interval` (integer) - Polling interval in minutes
      - `is_enabled` (boolean) - Whether monitoring is enabled
      - `last_check` (timestamp) - Last time emails were checked
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `email_monitoring_config` table
    - Add policy for public access to email monitoring config
*/

CREATE TABLE IF NOT EXISTS email_monitoring_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT '',
  client_id text NOT NULL DEFAULT '',
  client_secret text NOT NULL DEFAULT '',
  monitored_email text NOT NULL DEFAULT '',
  polling_interval integer NOT NULL DEFAULT 5,
  is_enabled boolean NOT NULL DEFAULT false,
  last_check timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_monitoring_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to email monitoring config"
  ON email_monitoring_config
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);