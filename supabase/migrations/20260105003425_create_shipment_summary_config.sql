/*
  # Create Shipment Summary Configuration Tables

  This migration adds configuration tables for the Shipment Summary section in Track & Trace.
  It allows admins to configure:
  - The header field (main big number displayed)
  - Timeline status display
  - Indicator buttons (Temp Controlled, Hazardous) based on boolean fields
  - Groups and fields (similar to Route Summary)

  1. New Tables:
    - `track_trace_shipment_summary_config`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to track_trace_templates, unique)
      - `header_field_name` (text) - API field for the main header number
      - `show_timeline_status` (boolean) - Whether to show current timeline status badge
      - `temp_controlled_field` (text) - API field to check for Temp Controlled indicator
      - `temp_controlled_label` (text) - Label for the indicator button
      - `hazardous_field` (text) - API field to check for Hazardous indicator
      - `hazardous_label` (text) - Label for the indicator button
      
    - `track_trace_shipment_summary_groups`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to track_trace_templates)
      - `name` (text) - Group name
      - `display_order` (integer)
      
    - `track_trace_shipment_summary_fields`
      - `id` (uuid, primary key)
      - `group_id` (uuid, FK to groups)
      - `label` (text)
      - `api_field` (text)
      - `display_order` (integer)

  2. Security:
    - Enable RLS on all tables
    - Add public access policies (matching existing track_trace tables)

  3. Foreign Keys:
    - All tables link to track_trace_templates with cascade delete
*/

CREATE TABLE IF NOT EXISTS track_trace_shipment_summary_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  header_field_name text DEFAULT 'billNumber',
  show_timeline_status boolean DEFAULT true,
  temp_controlled_field text DEFAULT 'temperatureControlled',
  temp_controlled_label text DEFAULT 'Temp Controlled',
  hazardous_field text DEFAULT 'isDangerousGoods',
  hazardous_label text DEFAULT 'Hazardous',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id)
);

CREATE INDEX IF NOT EXISTS idx_shipment_summary_config_template_id 
  ON track_trace_shipment_summary_config(template_id);

ALTER TABLE track_trace_shipment_summary_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to shipment_summary_config"
  ON track_trace_shipment_summary_config FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public write access to shipment_summary_config"
  ON track_trace_shipment_summary_config FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS track_trace_shipment_summary_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_summary_groups_template_id 
  ON track_trace_shipment_summary_groups(template_id);

CREATE INDEX IF NOT EXISTS idx_shipment_summary_groups_display_order 
  ON track_trace_shipment_summary_groups(template_id, display_order);

ALTER TABLE track_trace_shipment_summary_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to shipment_summary_groups"
  ON track_trace_shipment_summary_groups FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public write access to shipment_summary_groups"
  ON track_trace_shipment_summary_groups FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS track_trace_shipment_summary_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES track_trace_shipment_summary_groups(id) ON DELETE CASCADE,
  label text NOT NULL,
  api_field text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_summary_fields_group_id 
  ON track_trace_shipment_summary_fields(group_id);

CREATE INDEX IF NOT EXISTS idx_shipment_summary_fields_display_order 
  ON track_trace_shipment_summary_fields(group_id, display_order);

ALTER TABLE track_trace_shipment_summary_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to shipment_summary_fields"
  ON track_trace_shipment_summary_fields FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public write access to shipment_summary_fields"
  ON track_trace_shipment_summary_fields FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

COMMENT ON TABLE track_trace_shipment_summary_config IS 'Configuration for the Shipment Summary section header, status, and indicator buttons';
COMMENT ON COLUMN track_trace_shipment_summary_config.header_field_name IS 'API field name for the main header number (e.g., billNumber instead of orderId)';
COMMENT ON COLUMN track_trace_shipment_summary_config.show_timeline_status IS 'Whether to display the current timeline status badge';
COMMENT ON COLUMN track_trace_shipment_summary_config.temp_controlled_field IS 'API field to check for temperature controlled indicator (boolean)';
COMMENT ON COLUMN track_trace_shipment_summary_config.hazardous_field IS 'API field to check for hazardous goods indicator (boolean)';

COMMENT ON TABLE track_trace_shipment_summary_groups IS 'Groups of fields to display in the Shipment Summary section';
COMMENT ON TABLE track_trace_shipment_summary_fields IS 'Individual fields within a Shipment Summary group';
