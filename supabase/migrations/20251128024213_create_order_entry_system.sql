/*
  # Create Order Entry System

  This migration creates the complete order entry system infrastructure.

  ## New Tables
  1. order_entry_config - Global API endpoint configuration
  2. order_entry_json_schemas - JSON schema storage
  3. order_entry_field_groups - Field grouping and organization
  4. order_entry_fields - Individual field definitions with AI instructions
  5. order_entry_field_layout - Drag-and-drop positioning
  6. order_entry_pdfs - PDF upload tracking
  7. order_entry_submissions - Form submission logs
  8. user_registration_tokens - Email verification tokens
*/

-- ORDER ENTRY CONFIGURATION
CREATE TABLE IF NOT EXISTS order_entry_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_endpoint text NOT NULL DEFAULT '',
  api_method text NOT NULL DEFAULT 'POST',
  api_headers jsonb DEFAULT '{}',
  api_auth_type text DEFAULT 'none',
  api_auth_token text DEFAULT '',
  workflow_id uuid REFERENCES extraction_workflows(id) ON DELETE SET NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- JSON SCHEMAS
CREATE TABLE IF NOT EXISTS order_entry_json_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name text NOT NULL,
  schema_version text NOT NULL DEFAULT '1.0',
  schema_content jsonb NOT NULL,
  field_paths text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- FIELD GROUPS
CREATE TABLE IF NOT EXISTS order_entry_field_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name text NOT NULL,
  group_order integer NOT NULL DEFAULT 0,
  description text DEFAULT '',
  is_collapsible boolean NOT NULL DEFAULT false,
  is_expanded_by_default boolean NOT NULL DEFAULT true,
  background_color text DEFAULT '',
  border_color text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- FIELDS
CREATE TABLE IF NOT EXISTS order_entry_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_group_id uuid REFERENCES order_entry_field_groups(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'phone', 'dropdown', 'file', 'boolean')),
  placeholder text DEFAULT '',
  help_text text DEFAULT '',
  is_required boolean NOT NULL DEFAULT false,
  max_length integer,
  min_value numeric,
  max_value numeric,
  default_value text DEFAULT '',
  dropdown_options jsonb DEFAULT '[]',
  json_path text NOT NULL,
  is_array_field boolean NOT NULL DEFAULT false,
  array_min_rows integer DEFAULT 1,
  array_max_rows integer DEFAULT 10,
  ai_extraction_instructions text DEFAULT '',
  validation_regex text DEFAULT '',
  validation_error_message text DEFAULT '',
  field_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- FIELD LAYOUT
CREATE TABLE IF NOT EXISTS order_entry_field_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid REFERENCES order_entry_fields(id) ON DELETE CASCADE,
  row_index integer NOT NULL DEFAULT 0,
  column_index integer NOT NULL DEFAULT 0,
  width_columns integer NOT NULL DEFAULT 12 CHECK (width_columns >= 1 AND width_columns <= 12),
  mobile_width_columns integer NOT NULL DEFAULT 12 CHECK (mobile_width_columns >= 1 AND mobile_width_columns <= 12),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(field_id)
);

-- PDF UPLOADS
CREATE TABLE IF NOT EXISTS order_entry_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint NOT NULL,
  page_count integer DEFAULT 1,
  extraction_status text NOT NULL DEFAULT 'pending' CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
  extracted_data jsonb DEFAULT '{}',
  extraction_confidence jsonb DEFAULT '{}',
  error_message text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- SUBMISSIONS
CREATE TABLE IF NOT EXISTS order_entry_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  pdf_id uuid REFERENCES order_entry_pdfs(id) ON DELETE SET NULL,
  submission_data jsonb NOT NULL,
  api_response jsonb DEFAULT '{}',
  api_status_code integer,
  workflow_execution_log_id uuid REFERENCES workflow_execution_logs(id) ON DELETE SET NULL,
  submission_status text NOT NULL DEFAULT 'pending' CHECK (submission_status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- USER REGISTRATION TOKENS
CREATE TABLE IF NOT EXISTS user_registration_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_order_entry_fields_group ON order_entry_fields(field_group_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_fields_order ON order_entry_fields(field_order);
CREATE INDEX IF NOT EXISTS idx_order_entry_field_layout_field ON order_entry_field_layout(field_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_pdfs_user ON order_entry_pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_pdfs_status ON order_entry_pdfs(extraction_status);
CREATE INDEX IF NOT EXISTS idx_order_entry_submissions_user ON order_entry_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_submissions_pdf ON order_entry_submissions(pdf_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_submissions_status ON order_entry_submissions(submission_status);
CREATE INDEX IF NOT EXISTS idx_user_registration_tokens_user ON user_registration_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_registration_tokens_token ON user_registration_tokens(token);
CREATE INDEX IF NOT EXISTS idx_user_registration_tokens_expires ON user_registration_tokens(expires_at);

-- ROW LEVEL SECURITY
ALTER TABLE order_entry_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_json_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_field_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_field_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_registration_tokens ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (Public access for all tables)
CREATE POLICY "Allow public read access to order entry config" ON order_entry_config FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to order entry config" ON order_entry_config FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to order entry config" ON order_entry_config FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access to order entry config" ON order_entry_config FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to json schemas" ON order_entry_json_schemas FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to json schemas" ON order_entry_json_schemas FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to json schemas" ON order_entry_json_schemas FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access to json schemas" ON order_entry_json_schemas FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to field groups" ON order_entry_field_groups FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to field groups" ON order_entry_field_groups FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to field groups" ON order_entry_field_groups FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access to field groups" ON order_entry_field_groups FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to fields" ON order_entry_fields FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to fields" ON order_entry_fields FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to fields" ON order_entry_fields FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access to fields" ON order_entry_fields FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to field layout" ON order_entry_field_layout FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to field layout" ON order_entry_field_layout FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to field layout" ON order_entry_field_layout FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access to field layout" ON order_entry_field_layout FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to pdfs" ON order_entry_pdfs FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to pdfs" ON order_entry_pdfs FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to pdfs" ON order_entry_pdfs FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access to pdfs" ON order_entry_pdfs FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to submissions" ON order_entry_submissions FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to submissions" ON order_entry_submissions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to submissions" ON order_entry_submissions FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access to submissions" ON order_entry_submissions FOR DELETE TO public USING (true);

CREATE POLICY "Allow public read access to registration tokens" ON user_registration_tokens FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert access to registration tokens" ON user_registration_tokens FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update access to registration tokens" ON user_registration_tokens FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access to registration tokens" ON user_registration_tokens FOR DELETE TO public USING (true);