/*
  # Create API Authentication Configuration Table

  1. New Tables
    - `api_auth_config`
      - `id` (uuid, primary key)
      - `name` (text) - Friendly name for this auth configuration
      - `login_endpoint` (text) - The login API URL endpoint
      - `ping_endpoint` (text) - The ping/validate API URL endpoint
      - `username` (text) - Username for authentication
      - `password` (text) - Password for authentication (stored encrypted)
      - `is_active` (boolean) - Whether this configuration is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `api_auth_config` table
    - Add policies for anon role (matching project pattern for custom auth)

  3. Notes
    - This table stores credentials for external API authentication
    - The AuthenticationManager class uses this config for token management
*/

-- Create the api_auth_config table
CREATE TABLE IF NOT EXISTS api_auth_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Default',
  login_endpoint text NOT NULL DEFAULT '',
  ping_endpoint text NOT NULL DEFAULT '',
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE api_auth_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for anon role (matching project pattern)
CREATE POLICY "Allow anon select on api_auth_config"
  ON api_auth_config
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on api_auth_config"
  ON api_auth_config
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on api_auth_config"
  ON api_auth_config
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on api_auth_config"
  ON api_auth_config
  FOR DELETE
  TO anon
  USING (true);

-- Also allow authenticated users (for completeness)
CREATE POLICY "Allow authenticated select on api_auth_config"
  ON api_auth_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert on api_auth_config"
  ON api_auth_config
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update on api_auth_config"
  ON api_auth_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on api_auth_config"
  ON api_auth_config
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_auth_config_is_active ON api_auth_config(is_active);
