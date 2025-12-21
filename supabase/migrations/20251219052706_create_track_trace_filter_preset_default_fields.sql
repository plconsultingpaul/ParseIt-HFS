/*
  # Add Default Fields to Quick Filter Presets

  1. New Tables
    - `track_trace_filter_preset_default_fields`
      - `id` (uuid, primary key)
      - `preset_id` (uuid, FK to track_trace_filter_presets)
      - `field_name` (text) - The field name/label
      - `parameter_type` (text) - query, path, header, or body
      - `api_field_path` (text, nullable) - API field path from spec
      - `value_type` (text) - static or dynamic
      - `static_value` (text, nullable) - Hardcoded values
      - `dynamic_value` (text, nullable) - Runtime references
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on preset_id for efficient lookups

  3. Security
    - Enable RLS
    - Public access policies (same as parent presets table)
*/

CREATE TABLE IF NOT EXISTS track_trace_filter_preset_default_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id uuid NOT NULL REFERENCES track_trace_filter_presets(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  parameter_type text NOT NULL CHECK (parameter_type IN ('query', 'path', 'header', 'body')),
  api_field_path text,
  value_type text NOT NULL CHECK (value_type IN ('static', 'dynamic')),
  static_value text,
  dynamic_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_track_trace_filter_preset_default_fields_preset_id 
  ON track_trace_filter_preset_default_fields(preset_id);

ALTER TABLE track_trace_filter_preset_default_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to preset default fields"
  ON track_trace_filter_preset_default_fields
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to preset default fields"
  ON track_trace_filter_preset_default_fields
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to preset default fields"
  ON track_trace_filter_preset_default_fields
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from preset default fields"
  ON track_trace_filter_preset_default_fields
  FOR DELETE
  TO public
  USING (true);
