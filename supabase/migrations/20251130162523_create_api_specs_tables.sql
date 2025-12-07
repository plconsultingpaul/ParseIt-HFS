/*
  # Create API Specs Tables

  ## Overview
  This migration creates tables to store and manage Swagger/OpenAPI specifications for both Base API and Secondary APIs.

  ## New Tables

  ### 1. `api_specs`
  Stores uploaded API specifications with metadata
  - `id` (uuid, primary key)
  - `api_endpoint_id` (text, nullable) - Reference to base API config
  - `secondary_api_id` (uuid, nullable) - Reference to secondary_api_configs table
  - `name` (text) - Spec name from info.title
  - `file_name` (text) - Original uploaded file name
  - `spec_content` (jsonb) - Full Swagger/OpenAPI spec JSON
  - `version` (text) - Spec version from info.version
  - `description` (text) - Spec description
  - `uploaded_at` (timestamptz) - Upload timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `api_spec_endpoints`
  Stores parsed endpoints from specifications
  - `id` (uuid, primary key)
  - `api_spec_id` (uuid, foreign key to api_specs)
  - `path` (text) - API endpoint path
  - `method` (text) - HTTP method (GET, POST, etc.)
  - `summary` (text) - Endpoint description
  - `parameters` (jsonb) - Parameter definitions
  - `request_body` (jsonb) - Request body schema
  - `responses` (jsonb) - Response definitions
  - `created_at` (timestamptz) - Creation timestamp

  ### 3. `api_endpoint_fields`
  Stores field definitions extracted from endpoints
  - `id` (uuid, primary key)
  - `api_spec_endpoint_id` (uuid, foreign key to api_spec_endpoints)
  - `field_name` (text) - Field name
  - `field_path` (text) - Full path to field (e.g., "user.address.city")
  - `field_type` (text) - Data type (string, number, boolean, etc.)
  - `is_required` (boolean) - Whether field is required
  - `description` (text) - Field description
  - `example` (text) - Example value
  - `format` (text) - Format specification (e.g., "email", "date-time")
  - `parent_field_id` (uuid, nullable) - For nested fields
  - `created_at` (timestamptz) - Creation timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their API specs
  - Cascade delete endpoints and fields when spec is deleted

  ## Indexes
  - Index on api_spec_id for fast endpoint lookups
  - Index on api_spec_endpoint_id for fast field lookups
  - Index on method and path for endpoint filtering
*/

-- Create api_specs table
CREATE TABLE IF NOT EXISTS api_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_endpoint_id text,
  secondary_api_id uuid REFERENCES secondary_api_configs(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_name text NOT NULL,
  spec_content jsonb NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  description text DEFAULT '',
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT api_specs_api_reference_check CHECK (
    (api_endpoint_id IS NOT NULL AND secondary_api_id IS NULL) OR
    (api_endpoint_id IS NULL AND secondary_api_id IS NOT NULL)
  )
);

-- Create api_spec_endpoints table
CREATE TABLE IF NOT EXISTS api_spec_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_spec_id uuid NOT NULL REFERENCES api_specs(id) ON DELETE CASCADE,
  path text NOT NULL,
  method text NOT NULL,
  summary text DEFAULT '',
  parameters jsonb DEFAULT '[]'::jsonb,
  request_body jsonb,
  responses jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create api_endpoint_fields table
CREATE TABLE IF NOT EXISTS api_endpoint_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_spec_endpoint_id uuid NOT NULL REFERENCES api_spec_endpoints(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_path text NOT NULL,
  field_type text NOT NULL DEFAULT 'string',
  is_required boolean DEFAULT false,
  description text DEFAULT '',
  example text,
  format text,
  parent_field_id uuid REFERENCES api_endpoint_fields(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_specs_api_endpoint ON api_specs(api_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_api_specs_secondary_api ON api_specs(secondary_api_id);
CREATE INDEX IF NOT EXISTS idx_api_specs_uploaded_at ON api_specs(uploaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_spec_endpoints_spec_id ON api_spec_endpoints(api_spec_id);
CREATE INDEX IF NOT EXISTS idx_api_spec_endpoints_method ON api_spec_endpoints(method);
CREATE INDEX IF NOT EXISTS idx_api_spec_endpoints_path ON api_spec_endpoints(path);

CREATE INDEX IF NOT EXISTS idx_api_endpoint_fields_endpoint_id ON api_endpoint_fields(api_spec_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_api_endpoint_fields_parent ON api_endpoint_fields(parent_field_id);

-- Enable Row Level Security
ALTER TABLE api_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_spec_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_endpoint_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_specs
CREATE POLICY "Authenticated users can view api_specs"
  ON api_specs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert api_specs"
  ON api_specs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update api_specs"
  ON api_specs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete api_specs"
  ON api_specs FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for api_spec_endpoints
CREATE POLICY "Authenticated users can view api_spec_endpoints"
  ON api_spec_endpoints FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert api_spec_endpoints"
  ON api_spec_endpoints FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update api_spec_endpoints"
  ON api_spec_endpoints FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete api_spec_endpoints"
  ON api_spec_endpoints FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for api_endpoint_fields
CREATE POLICY "Authenticated users can view api_endpoint_fields"
  ON api_endpoint_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert api_endpoint_fields"
  ON api_endpoint_fields FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update api_endpoint_fields"
  ON api_endpoint_fields FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete api_endpoint_fields"
  ON api_endpoint_fields FOR DELETE
  TO authenticated
  USING (true);