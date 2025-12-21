/*
  # Create Track & Trace Configuration Tables

  1. New Tables
    - `track_trace_configs`
      - `id` (uuid, primary key)
      - `client_id` (uuid, FK to clients)
      - `api_source_type` (text) - 'main' or 'secondary'
      - `secondary_api_id` (uuid, FK to secondary_api_configs, nullable)
      - `api_spec_id` (uuid, FK to api_specs, nullable)
      - `api_spec_endpoint_id` (uuid, FK to api_spec_endpoints, nullable)
      - `api_path` (text) - The endpoint path
      - `http_method` (text) - GET, POST, etc.
      - `limit_options` (jsonb) - Array of limit numbers
      - `order_by_options` (jsonb) - Array of order by field configs
      - `default_limit` (integer)
      - `default_order_by` (text)
      - `default_order_direction` (text) - 'asc' or 'desc'
      - `is_enabled` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `track_trace_fields`
      - `id` (uuid, primary key)
      - `config_id` (uuid, FK to track_trace_configs)
      - `field_type` (text) - 'filter' or 'select'
      - `field_name` (text) - API field name
      - `display_label` (text) - UI display label
      - `data_type` (text) - 'string', 'number', 'date', 'boolean'
      - `filter_operator` (text) - For filters: 'eq', 'contains', etc.
      - `is_required` (boolean)
      - `field_order` (integer)
      - `is_enabled` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Admin users can manage configs
    - Client users can read their own client's config

  3. Indexes
    - Index on client_id for track_trace_configs
    - Index on config_id for track_trace_fields
*/

-- Create track_trace_configs table
CREATE TABLE IF NOT EXISTS track_trace_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  api_source_type text NOT NULL DEFAULT 'main' CHECK (api_source_type IN ('main', 'secondary')),
  secondary_api_id uuid REFERENCES secondary_api_configs(id) ON DELETE SET NULL,
  api_spec_id uuid REFERENCES api_specs(id) ON DELETE SET NULL,
  api_spec_endpoint_id uuid REFERENCES api_spec_endpoints(id) ON DELETE SET NULL,
  api_path text NOT NULL DEFAULT '',
  http_method text NOT NULL DEFAULT 'GET' CHECK (http_method IN ('GET', 'POST')),
  limit_options jsonb NOT NULL DEFAULT '[10, 25, 50, 100]'::jsonb,
  order_by_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_limit integer NOT NULL DEFAULT 25,
  default_order_by text,
  default_order_direction text NOT NULL DEFAULT 'desc' CHECK (default_order_direction IN ('asc', 'desc')),
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

-- Create track_trace_fields table
CREATE TABLE IF NOT EXISTS track_trace_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES track_trace_configs(id) ON DELETE CASCADE,
  field_type text NOT NULL CHECK (field_type IN ('filter', 'select')),
  field_name text NOT NULL,
  display_label text NOT NULL,
  data_type text NOT NULL DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'date', 'boolean')),
  filter_operator text CHECK (filter_operator IN ('eq', 'ne', 'contains', 'startswith', 'endswith', 'gt', 'ge', 'lt', 'le')),
  is_required boolean NOT NULL DEFAULT false,
  field_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_track_trace_configs_client_id ON track_trace_configs(client_id);
CREATE INDEX IF NOT EXISTS idx_track_trace_fields_config_id ON track_trace_fields(config_id);

-- Enable RLS
ALTER TABLE track_trace_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_trace_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for track_trace_configs
CREATE POLICY "Admins can manage track trace configs"
  ON track_trace_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::text = auth.uid()::text
      AND users.is_admin = true
      AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::text = auth.uid()::text
      AND users.is_admin = true
      AND users.is_active = true
    )
  );

CREATE POLICY "Client users can read their own track trace config"
  ON track_trace_configs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::text = auth.uid()::text
      AND users.is_active = true
      AND users.client_id = track_trace_configs.client_id
      AND users.has_track_trace_access = true
    )
  );

-- Allow anon to read for client portal
CREATE POLICY "Anon can read track trace configs for client portal"
  ON track_trace_configs
  FOR SELECT
  TO anon
  USING (is_enabled = true);

-- RLS Policies for track_trace_fields
CREATE POLICY "Admins can manage track trace fields"
  ON track_trace_fields
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::text = auth.uid()::text
      AND users.is_admin = true
      AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::text = auth.uid()::text
      AND users.is_admin = true
      AND users.is_active = true
    )
  );

CREATE POLICY "Client users can read their own track trace fields"
  ON track_trace_fields
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM track_trace_configs ttc
      JOIN users u ON u.client_id = ttc.client_id
      WHERE ttc.id = track_trace_fields.config_id
      AND u.id::text = auth.uid()::text
      AND u.is_active = true
      AND u.has_track_trace_access = true
    )
  );

-- Allow anon to read for client portal
CREATE POLICY "Anon can read track trace fields for client portal"
  ON track_trace_fields
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM track_trace_configs ttc
      WHERE ttc.id = track_trace_fields.config_id
      AND ttc.is_enabled = true
    )
  );