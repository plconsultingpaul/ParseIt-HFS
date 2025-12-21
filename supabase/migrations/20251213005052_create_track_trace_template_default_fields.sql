/*
  # Create Track & Trace Template Default Fields

  This migration adds a table for storing default field values that are automatically
  sent to the API when a client uses Track & Trace. These fields are not visible to
  the client user and are applied behind the scenes.

  1. New Tables
    - `track_trace_template_default_fields`
      - `id` (uuid, primary key)
      - `template_id` (uuid) - FK to track_trace_templates
      - `field_name` (text) - The name/label for this default field
      - `parameter_type` (text) - Where the value is placed: query, path, header, body
      - `api_field_path` (text) - The API field path from the spec
      - `value_type` (text) - 'static' for hardcoded values, 'dynamic' for runtime values
      - `static_value` (text, nullable) - The hardcoded value when value_type is 'static'
      - `dynamic_value` (text, nullable) - The dynamic reference when value_type is 'dynamic'
        - e.g., 'client.client_id' for the logged-in user's client_id
      - `created_at`, `updated_at` (timestamps)

  2. Security
    - Enable RLS on new table
    - Add policies for authenticated users (admin management)
    - Add policies for anon users (read access for client portal)
*/

-- Create track_trace_template_default_fields table
CREATE TABLE IF NOT EXISTS track_trace_template_default_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  parameter_type text NOT NULL DEFAULT 'query' CHECK (parameter_type IN ('query', 'path', 'header', 'body')),
  api_field_path text,
  value_type text NOT NULL DEFAULT 'static' CHECK (value_type IN ('static', 'dynamic')),
  static_value text,
  dynamic_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_track_trace_template_default_fields_template_id 
  ON track_trace_template_default_fields(template_id);

-- Enable RLS
ALTER TABLE track_trace_template_default_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for track_trace_template_default_fields
CREATE POLICY "Authenticated users can view default fields"
  ON track_trace_template_default_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert default fields"
  ON track_trace_template_default_fields FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update default fields"
  ON track_trace_template_default_fields FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete default fields"
  ON track_trace_template_default_fields FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can view default fields of active templates"
  ON track_trace_template_default_fields FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM track_trace_templates
      WHERE track_trace_templates.id = track_trace_template_default_fields.template_id
      AND track_trace_templates.is_active = true
    )
  );
