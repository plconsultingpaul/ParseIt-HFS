/*
  # Create Track & Trace Filter Presets (Quick Filter Buttons)

  1. New Tables
    - `track_trace_filter_presets`
      - `id` (uuid, primary key)
      - `template_id` (uuid, foreign key to track_trace_templates)
      - `name` (text) - Button label displayed to users (e.g., "In Transit", "Delivered")
      - `display_order` (integer) - Controls the order buttons appear
      - `filter_values` (jsonb) - Pre-configured filter field values
      - `is_active` (boolean) - Whether the button is visible to customers
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `track_trace_filter_presets` table
    - Add policies for public access (matches existing track_trace tables pattern)

  3. Notes
    - Filter values are stored as JSONB with structure: { "fieldName": "value", ... }
    - Display order allows admins to control button arrangement
    - Inactive presets are hidden from the customer view
*/

CREATE TABLE IF NOT EXISTS track_trace_filter_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  filter_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_track_trace_filter_presets_template_id 
  ON track_trace_filter_presets(template_id);

CREATE INDEX IF NOT EXISTS idx_track_trace_filter_presets_display_order 
  ON track_trace_filter_presets(template_id, display_order);

ALTER TABLE track_trace_filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to track_trace_filter_presets"
  ON track_trace_filter_presets
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to track_trace_filter_presets"
  ON track_trace_filter_presets
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_filter_presets"
  ON track_trace_filter_presets
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_filter_presets"
  ON track_trace_filter_presets
  FOR DELETE
  TO public
  USING (true);
