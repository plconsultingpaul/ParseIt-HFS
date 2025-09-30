/*
  # Create security settings table

  1. New Tables
    - `security_settings`
      - `id` (uuid, primary key)
      - `default_upload_mode` (text, default 'manual')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Security
    - Enable RLS on `security_settings` table
    - Add policy for public access (admin-controlled settings)
  
  3. Initial Data
    - Insert default security settings record
*/

CREATE TABLE IF NOT EXISTS security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_upload_mode text DEFAULT 'manual' CHECK (default_upload_mode IN ('manual', 'auto')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to security settings"
  ON security_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Insert default security settings
INSERT INTO security_settings (default_upload_mode, created_at, updated_at)
VALUES ('manual', now(), now());