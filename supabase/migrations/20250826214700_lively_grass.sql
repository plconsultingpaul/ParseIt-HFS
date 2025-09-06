/*
  # Create API settings table

  1. New Tables
    - `api_settings`
      - `id` (uuid, primary key)
      - `path` (text)
      - `password` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `api_settings` table
    - Add policy for public access to API settings
*/

CREATE TABLE IF NOT EXISTS api_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text DEFAULT '' NOT NULL,
  password text DEFAULT '' NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE api_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to API settings"
  ON api_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);