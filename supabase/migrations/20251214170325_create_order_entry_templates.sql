/*
  # Create Order Entry Templates System

  1. New Tables
    - `order_entry_templates` - Main template table for reusable order entry form configurations
      - `id` (uuid, primary key)
      - `name` (text, required) - Template display name
      - `description` (text) - Optional description
      - `workflow_id` (uuid, optional) - Associated workflow for submission
      - `is_active` (boolean) - Whether template can be assigned to clients
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `order_entry_template_field_groups` - Field groups within a template
      - `id` (uuid, primary key)
      - `template_id` (uuid, foreign key to order_entry_templates)
      - `group_name` (text, required)
      - `group_order` (integer)
      - Standard group configuration columns

    - `order_entry_template_fields` - Fields within groups
      - `id` (uuid, primary key)
      - `template_id` (uuid, foreign key)
      - `field_group_id` (uuid, foreign key)
      - Standard field configuration columns

    - `order_entry_template_field_layout` - Layout configuration for fields
      - `id` (uuid, primary key)
      - `template_id` (uuid, foreign key)
      - `field_id` (uuid, foreign key)
      - Layout positioning columns

  2. Schema Changes
    - Add `order_entry_template_id` to `clients` table

  3. Security
    - Enable RLS on all new tables
    - Add public access policies (custom auth system)

  4. Indexes
    - Index on template_id for all child tables
    - Index on clients.order_entry_template_id
*/

-- Create order_entry_templates table
CREATE TABLE IF NOT EXISTS order_entry_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  workflow_id uuid REFERENCES extraction_workflows(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_entry_template_field_groups table
CREATE TABLE IF NOT EXISTS order_entry_template_field_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES order_entry_templates(id) ON DELETE CASCADE,
  group_name text NOT NULL,
  group_order integer NOT NULL DEFAULT 0,
  description text,
  is_collapsible boolean NOT NULL DEFAULT false,
  is_expanded_by_default boolean NOT NULL DEFAULT true,
  background_color text,
  border_color text,
  is_array_group boolean NOT NULL DEFAULT false,
  array_min_rows integer NOT NULL DEFAULT 1,
  array_max_rows integer NOT NULL DEFAULT 10,
  array_json_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_entry_template_fields table
CREATE TABLE IF NOT EXISTS order_entry_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES order_entry_templates(id) ON DELETE CASCADE,
  field_group_id uuid NOT NULL REFERENCES order_entry_template_field_groups(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'phone', 'dropdown', 'file', 'boolean', 'zip', 'postal_code', 'province', 'state')),
  placeholder text,
  help_text text,
  is_required boolean NOT NULL DEFAULT false,
  max_length integer,
  min_value numeric,
  max_value numeric,
  default_value text,
  dropdown_options jsonb DEFAULT '[]'::jsonb,
  json_path text,
  is_array_field boolean NOT NULL DEFAULT false,
  array_min_rows integer NOT NULL DEFAULT 1,
  array_max_rows integer NOT NULL DEFAULT 10,
  ai_extraction_instructions text,
  validation_regex text,
  validation_error_message text,
  field_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create order_entry_template_field_layout table
CREATE TABLE IF NOT EXISTS order_entry_template_field_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES order_entry_templates(id) ON DELETE CASCADE,
  field_id uuid NOT NULL REFERENCES order_entry_template_fields(id) ON DELETE CASCADE,
  row_index integer NOT NULL DEFAULT 0,
  column_index integer NOT NULL DEFAULT 0,
  width_columns integer NOT NULL DEFAULT 12,
  mobile_width_columns integer NOT NULL DEFAULT 12,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_template_field_layout UNIQUE (template_id, field_id)
);

-- Add order_entry_template_id to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'order_entry_template_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN order_entry_template_id uuid REFERENCES order_entry_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE order_entry_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_template_field_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_entry_template_field_layout ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for order_entry_templates
CREATE POLICY "Allow public read access to order_entry_templates"
  ON order_entry_templates FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to order_entry_templates"
  ON order_entry_templates FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to order_entry_templates"
  ON order_entry_templates FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to order_entry_templates"
  ON order_entry_templates FOR DELETE TO public USING (true);

-- Create RLS policies for order_entry_template_field_groups
CREATE POLICY "Allow public read access to order_entry_template_field_groups"
  ON order_entry_template_field_groups FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to order_entry_template_field_groups"
  ON order_entry_template_field_groups FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to order_entry_template_field_groups"
  ON order_entry_template_field_groups FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to order_entry_template_field_groups"
  ON order_entry_template_field_groups FOR DELETE TO public USING (true);

-- Create RLS policies for order_entry_template_fields
CREATE POLICY "Allow public read access to order_entry_template_fields"
  ON order_entry_template_fields FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to order_entry_template_fields"
  ON order_entry_template_fields FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to order_entry_template_fields"
  ON order_entry_template_fields FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to order_entry_template_fields"
  ON order_entry_template_fields FOR DELETE TO public USING (true);

-- Create RLS policies for order_entry_template_field_layout
CREATE POLICY "Allow public read access to order_entry_template_field_layout"
  ON order_entry_template_field_layout FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to order_entry_template_field_layout"
  ON order_entry_template_field_layout FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to order_entry_template_field_layout"
  ON order_entry_template_field_layout FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to order_entry_template_field_layout"
  ON order_entry_template_field_layout FOR DELETE TO public USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_entry_templates_is_active ON order_entry_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_order_entry_template_field_groups_template_id ON order_entry_template_field_groups(template_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_template_fields_template_id ON order_entry_template_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_template_fields_field_group_id ON order_entry_template_fields(field_group_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_template_field_layout_template_id ON order_entry_template_field_layout(template_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_template_field_layout_field_id ON order_entry_template_field_layout(field_id);
CREATE INDEX IF NOT EXISTS idx_clients_order_entry_template_id ON clients(order_entry_template_id);