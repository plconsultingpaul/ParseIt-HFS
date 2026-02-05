/*
  # Create Track & Trace Barcode Details Configuration Tables

  This migration creates tables to support configurable barcode details sections
  in the shipment details page, including field mappings for grid display
  and image viewing configuration.

  1. New Tables
    - `track_trace_barcode_configs`
      - `id` (uuid, primary key)
      - `template_id` (uuid) - FK to track_trace_templates
      - `api_source_type` (text) - 'main' or 'secondary'
      - `secondary_api_id` (uuid, nullable) - FK to secondary_api_configs
      - `api_spec_id` (uuid, nullable) - FK to api_specs
      - `api_spec_endpoint_id` (uuid, nullable) - FK to api_spec_endpoints
      - `response_array_path` (text) - Path to array in API response
      - `created_at`, `updated_at` (timestamps)

    - `track_trace_barcode_fields`
      - `id` (uuid, primary key)
      - `barcode_config_id` (uuid) - FK to track_trace_barcode_configs
      - `label` (text) - Column header text
      - `api_field` (text) - Field path in API response
      - `show_total` (boolean) - Whether to show total in footer row
      - `display_order` (integer) - Column ordering
      - `created_at`, `updated_at` (timestamps)

    - `track_trace_barcode_image_configs`
      - `id` (uuid, primary key)
      - `barcode_config_id` (uuid) - FK to track_trace_barcode_configs
      - `api_url` (text) - API endpoint for images with variable placeholders
      - `auth_config_id` (uuid, nullable) - FK to api_auth_config
      - `source_field` (text) - Field from barcode data to pass to images API
      - `created_at`, `updated_at` (timestamps)

  2. Security
    - Enable RLS on all tables
    - Add policies for public role (matching existing track trace tables)
*/

-- Create track_trace_barcode_configs table
CREATE TABLE IF NOT EXISTS track_trace_barcode_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  api_source_type text NOT NULL DEFAULT 'main',
  secondary_api_id uuid REFERENCES secondary_api_configs(id) ON DELETE SET NULL,
  api_spec_id uuid REFERENCES api_specs(id) ON DELETE SET NULL,
  api_spec_endpoint_id uuid REFERENCES api_spec_endpoints(id) ON DELETE SET NULL,
  response_array_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_barcode_api_source_type CHECK (api_source_type IN ('main', 'secondary'))
);

-- Create track_trace_barcode_fields table
CREATE TABLE IF NOT EXISTS track_trace_barcode_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_config_id uuid NOT NULL REFERENCES track_trace_barcode_configs(id) ON DELETE CASCADE,
  label text NOT NULL,
  api_field text NOT NULL,
  show_total boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create track_trace_barcode_image_configs table
CREATE TABLE IF NOT EXISTS track_trace_barcode_image_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode_config_id uuid NOT NULL REFERENCES track_trace_barcode_configs(id) ON DELETE CASCADE,
  api_url text NOT NULL DEFAULT '',
  auth_config_id uuid REFERENCES api_auth_config(id) ON DELETE SET NULL,
  source_field text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_track_trace_barcode_configs_template_id ON track_trace_barcode_configs(template_id);
CREATE INDEX IF NOT EXISTS idx_track_trace_barcode_fields_config_id ON track_trace_barcode_fields(barcode_config_id);
CREATE INDEX IF NOT EXISTS idx_track_trace_barcode_fields_display_order ON track_trace_barcode_fields(display_order);
CREATE INDEX IF NOT EXISTS idx_track_trace_barcode_image_configs_config_id ON track_trace_barcode_image_configs(barcode_config_id);

-- Enable RLS
ALTER TABLE track_trace_barcode_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_trace_barcode_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_trace_barcode_image_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for track_trace_barcode_configs (using public role to match other track trace tables)
CREATE POLICY "Allow public read access to track_trace_barcode_configs"
  ON track_trace_barcode_configs FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to track_trace_barcode_configs"
  ON track_trace_barcode_configs FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_barcode_configs"
  ON track_trace_barcode_configs FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_barcode_configs"
  ON track_trace_barcode_configs FOR DELETE TO public USING (true);

-- RLS Policies for track_trace_barcode_fields
CREATE POLICY "Allow public read access to track_trace_barcode_fields"
  ON track_trace_barcode_fields FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to track_trace_barcode_fields"
  ON track_trace_barcode_fields FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_barcode_fields"
  ON track_trace_barcode_fields FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_barcode_fields"
  ON track_trace_barcode_fields FOR DELETE TO public USING (true);

-- RLS Policies for track_trace_barcode_image_configs
CREATE POLICY "Allow public read access to track_trace_barcode_image_configs"
  ON track_trace_barcode_image_configs FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to track_trace_barcode_image_configs"
  ON track_trace_barcode_image_configs FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_barcode_image_configs"
  ON track_trace_barcode_image_configs FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_barcode_image_configs"
  ON track_trace_barcode_image_configs FOR DELETE TO public USING (true);
