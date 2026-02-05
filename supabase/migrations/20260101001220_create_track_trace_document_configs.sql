/*
  # Track & Trace Document Configuration System

  1. New Tables
    - `track_trace_document_configs`
      - `id` (uuid, primary key)
      - `template_id` (uuid, FK to track_trace_templates)
      - `name` (text) - Configuration name (e.g., "POD Documents")
      - `search_api_url` (text) - API #1 base URL for searching documents
      - `get_document_api_url` (text) - API #2 URL template with {docId} placeholder
      - `doc_id_field` (text) - Response field containing document ID
      - `doc_name_field` (text) - Response field for filename
      - `doc_type_field` (text) - Response field for file type
      - `doc_size_field` (text) - Response field for file size
      - `sort_order` (integer) - Display order
      - `is_enabled` (boolean) - Whether config is active
      - `created_at`, `updated_at` (timestamps)

    - `track_trace_document_filters`
      - `id` (uuid, primary key)
      - `document_config_id` (uuid, FK to track_trace_document_configs)
      - `field_name` (text) - Filter field name (e.g., "FBNumber")
      - `value_type` (text) - 'variable' or 'static'
      - `variable_name` (text) - Shipment field to use if value_type is 'variable'
      - `static_value` (text) - Fixed value if value_type is 'static'
      - `sort_order` (integer) - Filter order for building query
      - `created_at`, `updated_at` (timestamps)

  2. Security
    - Enable RLS on both tables
    - Add policies for public access (consistent with other track_trace tables)

  3. Indexes
    - Index on template_id for document_configs
    - Index on document_config_id for filters
*/

-- Create track_trace_document_configs table
CREATE TABLE IF NOT EXISTS track_trace_document_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES track_trace_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  search_api_url text NOT NULL,
  get_document_api_url text NOT NULL,
  doc_id_field text NOT NULL DEFAULT 'docId',
  doc_name_field text NOT NULL DEFAULT 'fileName',
  doc_type_field text DEFAULT 'fileExtension',
  doc_size_field text DEFAULT 'fileSize',
  sort_order integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create track_trace_document_filters table
CREATE TABLE IF NOT EXISTS track_trace_document_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_config_id uuid NOT NULL REFERENCES track_trace_document_configs(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('variable', 'static')),
  variable_name text,
  static_value text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_track_trace_document_configs_template_id 
  ON track_trace_document_configs(template_id);

CREATE INDEX IF NOT EXISTS idx_track_trace_document_filters_config_id 
  ON track_trace_document_filters(document_config_id);

-- Enable RLS
ALTER TABLE track_trace_document_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_trace_document_filters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for track_trace_document_configs (public access like other track_trace tables)
CREATE POLICY "Allow public read access to document configs"
  ON track_trace_document_configs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to document configs"
  ON track_trace_document_configs
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to document configs"
  ON track_trace_document_configs
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to document configs"
  ON track_trace_document_configs
  FOR DELETE
  TO public
  USING (true);

-- RLS Policies for track_trace_document_filters
CREATE POLICY "Allow public read access to document filters"
  ON track_trace_document_filters
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to document filters"
  ON track_trace_document_filters
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to document filters"
  ON track_trace_document_filters
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to document filters"
  ON track_trace_document_filters
  FOR DELETE
  TO public
  USING (true);