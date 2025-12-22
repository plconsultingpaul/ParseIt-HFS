/*
  # Create Track & Trace Template Sections Table

  1. New Tables
    - `track_trace_template_sections`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to track_trace_templates)
      - `section_type` (text) - one of: shipment_summary, shipment_timeline, route_summary, trace_numbers, barcode_details, documents
      - `display_order` (integer) - for ordering sections on the page
      - `is_enabled` (boolean, default true) - show/hide section
      - `config` (jsonb, default {}) - placeholder for section-specific settings
      - `created_at`, `updated_at` timestamps

  2. Security
    - Enable RLS on `track_trace_template_sections` table
    - Add policy for public read/write access (matching existing track_trace tables)

  3. Foreign Key
    - Links to track_trace_templates with cascade delete
*/

CREATE TABLE IF NOT EXISTS track_trace_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  section_type text NOT NULL CHECK (section_type IN ('shipment_summary', 'shipment_timeline', 'route_summary', 'trace_numbers', 'barcode_details', 'documents')),
  display_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, section_type)
);

CREATE INDEX IF NOT EXISTS idx_track_trace_template_sections_template_id 
  ON track_trace_template_sections(template_id);

CREATE INDEX IF NOT EXISTS idx_track_trace_template_sections_display_order 
  ON track_trace_template_sections(template_id, display_order);

ALTER TABLE track_trace_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to track_trace_template_sections"
  ON track_trace_template_sections
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to track_trace_template_sections"
  ON track_trace_template_sections
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_template_sections"
  ON track_trace_template_sections
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_template_sections"
  ON track_trace_template_sections
  FOR DELETE
  TO public
  USING (true);

CREATE OR REPLACE FUNCTION create_default_template_sections()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO track_trace_template_sections (template_id, section_type, display_order)
  VALUES
    (NEW.id, 'shipment_summary', 1),
    (NEW.id, 'shipment_timeline', 2),
    (NEW.id, 'route_summary', 3),
    (NEW.id, 'trace_numbers', 4),
    (NEW.id, 'barcode_details', 5),
    (NEW.id, 'documents', 6);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_default_template_sections ON track_trace_templates;

CREATE TRIGGER trigger_create_default_template_sections
  AFTER INSERT ON track_trace_templates
  FOR EACH ROW
  EXECUTE FUNCTION create_default_template_sections();

INSERT INTO track_trace_template_sections (template_id, section_type, display_order)
SELECT t.id, s.section_type, s.display_order
FROM track_trace_templates t
CROSS JOIN (
  VALUES 
    ('shipment_summary', 1),
    ('shipment_timeline', 2),
    ('route_summary', 3),
    ('trace_numbers', 4),
    ('barcode_details', 5),
    ('documents', 6)
) AS s(section_type, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM track_trace_template_sections tts 
  WHERE tts.template_id = t.id AND tts.section_type = s.section_type
);