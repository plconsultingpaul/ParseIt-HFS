/*
  # Create Execute Button Categories System

  1. New Tables
    - `execute_button_categories`
      - `id` (uuid, primary key)
      - `name` (text) - Category name like "Operations", "Accounting"
      - `display_order` (integer) - Order tabs appear
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `execute_button_category_assignments`
      - `id` (uuid, primary key)
      - `button_id` (uuid, foreign key to execute_buttons)
      - `category_id` (uuid, foreign key to execute_button_categories)
      - `created_at` (timestamptz)
      - Unique constraint on (button_id, category_id) to prevent duplicates

  2. Security
    - Enable RLS on both tables
    - Add policies for public access (matches existing execute_buttons pattern)

  3. Notes
    - Buttons can belong to multiple categories (many-to-many relationship)
    - Categories are used for filtering buttons on the Execute page
*/

CREATE TABLE IF NOT EXISTS execute_button_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS execute_button_category_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  button_id uuid NOT NULL REFERENCES execute_buttons(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES execute_button_categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(button_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_execute_button_category_assignments_button_id 
  ON execute_button_category_assignments(button_id);

CREATE INDEX IF NOT EXISTS idx_execute_button_category_assignments_category_id 
  ON execute_button_category_assignments(category_id);

ALTER TABLE execute_button_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE execute_button_category_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to execute_button_categories"
  ON execute_button_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert access to execute_button_categories"
  ON execute_button_categories FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update access to execute_button_categories"
  ON execute_button_categories FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to execute_button_categories"
  ON execute_button_categories FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public read access to execute_button_category_assignments"
  ON execute_button_category_assignments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert access to execute_button_category_assignments"
  ON execute_button_category_assignments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update access to execute_button_category_assignments"
  ON execute_button_category_assignments FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to execute_button_category_assignments"
  ON execute_button_category_assignments FOR DELETE
  TO anon, authenticated
  USING (true);
