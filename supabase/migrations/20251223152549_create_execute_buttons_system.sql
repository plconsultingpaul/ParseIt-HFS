/*
  # Create Execute Buttons System

  1. New Tables
    - `execute_buttons` - Main table for execute button configurations
      - `id` (uuid, primary key)
      - `name` (text, required) - Button display name
      - `description` (text) - Button description
      - `sort_order` (integer) - Display order
      - `is_active` (boolean) - Enable/disable button
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `execute_button_groups` - Groups/pages within each button wizard
      - `id` (uuid, primary key)
      - `button_id` (uuid, foreign key to execute_buttons)
      - `name` (text, required) - Group/page name
      - `description` (text) - Optional description
      - `sort_order` (integer) - Page order in wizard

    - `execute_button_fields` - Fields/parameters within each group
      - `id` (uuid, primary key)
      - `group_id` (uuid, foreign key to execute_button_groups)
      - `name` (text, required) - Field label
      - `field_key` (text, required) - Parameter key name
      - `field_type` (text) - Field type (text, number, date, datetime, phone, zip, postal_code, province, state, dropdown)
      - `is_required` (boolean) - Required field flag
      - `default_value` (text) - Optional default value
      - `options` (jsonb) - Dropdown options for dropdown type
      - `sort_order` (integer) - Field order within group
      - `placeholder` (text) - Placeholder text
      - `help_text` (text) - Help text

  2. Security
    - Enable RLS on all tables
    - Add public access policies (custom auth system)

  3. Indexes
    - Index on button_id for groups table
    - Index on group_id for fields table
*/

-- Create execute_buttons table
CREATE TABLE IF NOT EXISTS execute_buttons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create execute_button_groups table
CREATE TABLE IF NOT EXISTS execute_button_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  button_id uuid NOT NULL REFERENCES execute_buttons(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create execute_button_fields table
CREATE TABLE IF NOT EXISTS execute_button_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES execute_button_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  field_key text NOT NULL,
  field_type text NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'phone', 'zip', 'postal_code', 'province', 'state', 'dropdown')),
  is_required boolean NOT NULL DEFAULT false,
  default_value text,
  options jsonb DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  placeholder text,
  help_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE execute_buttons ENABLE ROW LEVEL SECURITY;
ALTER TABLE execute_button_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE execute_button_fields ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for execute_buttons
CREATE POLICY "Allow public read access to execute_buttons"
  ON execute_buttons FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to execute_buttons"
  ON execute_buttons FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to execute_buttons"
  ON execute_buttons FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to execute_buttons"
  ON execute_buttons FOR DELETE TO public USING (true);

-- Create RLS policies for execute_button_groups
CREATE POLICY "Allow public read access to execute_button_groups"
  ON execute_button_groups FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to execute_button_groups"
  ON execute_button_groups FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to execute_button_groups"
  ON execute_button_groups FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to execute_button_groups"
  ON execute_button_groups FOR DELETE TO public USING (true);

-- Create RLS policies for execute_button_fields
CREATE POLICY "Allow public read access to execute_button_fields"
  ON execute_button_fields FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to execute_button_fields"
  ON execute_button_fields FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to execute_button_fields"
  ON execute_button_fields FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to execute_button_fields"
  ON execute_button_fields FOR DELETE TO public USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_execute_button_groups_button_id ON execute_button_groups(button_id);
CREATE INDEX IF NOT EXISTS idx_execute_button_fields_group_id ON execute_button_fields(group_id);
CREATE INDEX IF NOT EXISTS idx_execute_buttons_is_active ON execute_buttons(is_active);
CREATE INDEX IF NOT EXISTS idx_execute_buttons_sort_order ON execute_buttons(sort_order);