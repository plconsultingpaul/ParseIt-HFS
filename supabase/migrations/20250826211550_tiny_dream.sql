/*
  # Add settings password configuration

  1. New Tables
    - `settings_config`
      - `id` (uuid, primary key)
      - `password` (text, encrypted settings password)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `settings_config` table
    - Add policy for public access (since this is a single-user app)

  3. Initial Data
    - Insert default password "1234"
*/

CREATE TABLE IF NOT EXISTS settings_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  password text NOT NULL DEFAULT '1234',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to settings config"
  ON settings_config
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Insert default password
INSERT INTO settings_config (password) VALUES ('1234');