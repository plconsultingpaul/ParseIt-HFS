/*
  # Create Secondary API Configurations Table

  1. New Tables
    - `secondary_api_configs`
      - `id` (uuid, primary key) - Unique identifier for each secondary API
      - `name` (text) - Display name for the API (e.g., "Warehouse System", "Backup TMS")
      - `base_url` (text) - The base API path/URL
      - `auth_token` (text) - Optional authentication token for API calls
      - `description` (text) - Optional notes about this API configuration
      - `is_active` (boolean) - Whether this API is currently enabled
      - `created_at` (timestamptz) - When the configuration was created
      - `updated_at` (timestamptz) - When the configuration was last updated

  2. Purpose
    - Allows administrators to configure multiple secondary API endpoints
    - Each secondary API has its own base URL and authentication
    - Can be independently enabled/disabled
    - Does not affect the primary BASE URL API configuration in api_settings table

  3. Security
    - Enable RLS on `secondary_api_configs` table
    - Add policies for public access (allows authenticated users to manage secondary APIs)

  4. Indexes
    - Index on `is_active` for filtering active APIs
    - Index on `name` for searching/sorting
*/

-- Create secondary_api_configs table
CREATE TABLE IF NOT EXISTS secondary_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL,
  auth_token text DEFAULT '',
  description text DEFAULT '',
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE secondary_api_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to secondary API configs"
  ON secondary_api_configs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to secondary API configs"
  ON secondary_api_configs
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to secondary API configs"
  ON secondary_api_configs
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to secondary API configs"
  ON secondary_api_configs
  FOR DELETE
  TO public
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_secondary_api_configs_is_active
  ON secondary_api_configs(is_active);

CREATE INDEX IF NOT EXISTS idx_secondary_api_configs_name
  ON secondary_api_configs(name);
