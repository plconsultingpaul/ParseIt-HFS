/*
  # Create Execute Button Global Settings Table

  1. New Tables
    - `execute_button_global_settings`
      - `id` (integer, primary key, default 1, constrained to single row)
      - `default_flow_zoom` (integer, default 75 for 75% zoom)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on table
    - Add policy for public access (global settings)

  3. Data
    - Insert default row with 75% zoom
*/

CREATE TABLE IF NOT EXISTS execute_button_global_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_flow_zoom integer NOT NULL DEFAULT 75 CHECK (default_flow_zoom >= 25 AND default_flow_zoom <= 150),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE execute_button_global_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to execute button global settings"
  ON execute_button_global_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public update access to execute button global settings"
  ON execute_button_global_settings
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

INSERT INTO execute_button_global_settings (id, default_flow_zoom)
VALUES (1, 75)
ON CONFLICT (id) DO NOTHING;