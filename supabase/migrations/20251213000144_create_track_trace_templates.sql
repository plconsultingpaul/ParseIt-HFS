/*
  # Create Track & Trace Templates System

  This migration creates a template system for Track & Trace configurations,
  allowing admins to create reusable templates that can be assigned to multiple clients.

  1. New Tables
    - `track_trace_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Template name for display
      - `description` (text, nullable) - Optional description
      - `api_source_type` (text) - 'main' or 'secondary'
      - `secondary_api_id` (uuid, nullable) - FK to secondary_api_configs
      - `api_spec_id` (uuid, nullable) - FK to api_specs
      - `api_spec_endpoint_id` (uuid, nullable) - FK to api_spec_endpoints
      - `api_path` (text) - The API endpoint path
      - `http_method` (text) - 'GET' or 'POST'
      - `limit_options` (jsonb) - Array of limit numbers
      - `order_by_options` (jsonb) - Array of order by configurations
      - `default_limit` (integer)
      - `default_order_by` (text, nullable)
      - `default_order_direction` (text) - 'asc' or 'desc'
      - `is_active` (boolean) - Whether template is available for assignment
      - `created_at`, `updated_at` (timestamps)
    
    - `track_trace_template_fields`
      - `id` (uuid, primary key)
      - `template_id` (uuid) - FK to track_trace_templates
      - `field_type` (text) - 'filter' or 'select'
      - `field_name` (text) - API field name
      - `display_label` (text) - UI display label
      - `data_type` (text) - 'string', 'number', 'date', 'boolean'
      - `filter_operator` (text, nullable) - For filters only
      - `is_required` (boolean)
      - `field_order` (integer)
      - `is_enabled` (boolean)
      - `created_at`, `updated_at` (timestamps)

  2. Changes to Existing Tables
    - Add `track_trace_template_id` column to `clients` table

  3. Security
    - Enable RLS on new tables
    - Add policies for authenticated and anon users
*/

-- Create track_trace_templates table
CREATE TABLE IF NOT EXISTS track_trace_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  api_source_type text NOT NULL DEFAULT 'main',
  secondary_api_id uuid REFERENCES secondary_api_configs(id) ON DELETE SET NULL,
  api_spec_id uuid REFERENCES api_specs(id) ON DELETE SET NULL,
  api_spec_endpoint_id uuid REFERENCES api_spec_endpoints(id) ON DELETE SET NULL,
  api_path text NOT NULL DEFAULT '',
  http_method text NOT NULL DEFAULT 'GET',
  limit_options jsonb NOT NULL DEFAULT '[10, 25, 50, 100]'::jsonb,
  order_by_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_limit integer NOT NULL DEFAULT 25,
  default_order_by text,
  default_order_direction text NOT NULL DEFAULT 'desc',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create track_trace_template_fields table
CREATE TABLE IF NOT EXISTS track_trace_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  field_type text NOT NULL,
  field_name text NOT NULL,
  display_label text NOT NULL,
  data_type text NOT NULL DEFAULT 'string',
  filter_operator text,
  is_required boolean NOT NULL DEFAULT false,
  field_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_field_type CHECK (field_type IN ('filter', 'select')),
  CONSTRAINT valid_data_type CHECK (data_type IN ('string', 'number', 'date', 'boolean'))
);

-- Add template_id to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'track_trace_template_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN track_trace_template_id uuid REFERENCES track_trace_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_track_trace_templates_is_active ON track_trace_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_track_trace_template_fields_template_id ON track_trace_template_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_clients_track_trace_template_id ON clients(track_trace_template_id);

-- Enable RLS
ALTER TABLE track_trace_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_trace_template_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for track_trace_templates
CREATE POLICY "Authenticated users can view templates"
  ON track_trace_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert templates"
  ON track_trace_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update templates"
  ON track_trace_templates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete templates"
  ON track_trace_templates FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can view active templates"
  ON track_trace_templates FOR SELECT
  TO anon
  USING (is_active = true);

-- RLS Policies for track_trace_template_fields
CREATE POLICY "Authenticated users can view template fields"
  ON track_trace_template_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert template fields"
  ON track_trace_template_fields FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update template fields"
  ON track_trace_template_fields FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete template fields"
  ON track_trace_template_fields FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can view fields of active templates"
  ON track_trace_template_fields FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM track_trace_templates
      WHERE track_trace_templates.id = track_trace_template_fields.template_id
      AND track_trace_templates.is_active = true
    )
  );