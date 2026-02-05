/*
  # Create Track & Trace Timeline Status Tables

  1. New Tables
    - `track_trace_timeline_statuses`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to track_trace_templates)
      - `name` (text) - Display name like "Picked Up", "In Transit"
      - `display_order` (integer) - Order in timeline (1, 2, 3, 4)
      - `location_field` (text, nullable) - API field for location display
      - `date_field` (text, nullable) - API field for date display
      - `created_at`, `updated_at` timestamps

    - `track_trace_timeline_child_statuses`
      - `id` (uuid, primary key)
      - `timeline_status_id` (uuid, FK to track_trace_timeline_statuses)
      - `status_value` (text) - API status value that maps to parent
      - `display_order` (integer) - Order within parent status
      - `created_at` timestamp

  2. New Column on track_trace_template_sections
    - `timeline_status_field` stored in config jsonb

  3. Security
    - Enable RLS on both new tables
    - Add policies for public read/write access (matching existing track_trace tables)

  4. Foreign Keys
    - timeline_statuses links to track_trace_templates with cascade delete
    - child_statuses links to timeline_statuses with cascade delete
*/

-- Create timeline statuses table
CREATE TABLE IF NOT EXISTS track_trace_timeline_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  location_field text,
  date_field text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for timeline statuses
CREATE INDEX IF NOT EXISTS idx_track_trace_timeline_statuses_template_id 
  ON track_trace_timeline_statuses(template_id);

CREATE INDEX IF NOT EXISTS idx_track_trace_timeline_statuses_display_order 
  ON track_trace_timeline_statuses(template_id, display_order);

-- Create child statuses table
CREATE TABLE IF NOT EXISTS track_trace_timeline_child_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_status_id uuid NOT NULL REFERENCES track_trace_timeline_statuses(id) ON DELETE CASCADE,
  status_value text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for child statuses
CREATE INDEX IF NOT EXISTS idx_track_trace_timeline_child_statuses_parent 
  ON track_trace_timeline_child_statuses(timeline_status_id);

-- Enable RLS on timeline_statuses
ALTER TABLE track_trace_timeline_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to track_trace_timeline_statuses"
  ON track_trace_timeline_statuses
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to track_trace_timeline_statuses"
  ON track_trace_timeline_statuses
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_timeline_statuses"
  ON track_trace_timeline_statuses
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_timeline_statuses"
  ON track_trace_timeline_statuses
  FOR DELETE
  TO public
  USING (true);

-- Enable RLS on child_statuses
ALTER TABLE track_trace_timeline_child_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to track_trace_timeline_child_statuses"
  ON track_trace_timeline_child_statuses
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to track_trace_timeline_child_statuses"
  ON track_trace_timeline_child_statuses
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_timeline_child_statuses"
  ON track_trace_timeline_child_statuses
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_timeline_child_statuses"
  ON track_trace_timeline_child_statuses
  FOR DELETE
  TO public
  USING (true);