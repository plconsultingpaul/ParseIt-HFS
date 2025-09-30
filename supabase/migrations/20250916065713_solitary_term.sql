/*
  # Create transformation_types table

  1. New Tables
    - `transformation_types`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `default_instructions` (text)
      - `filename_template` (text)
      - `field_mappings` (jsonb)
      - `auto_detect_instructions` (text)
      - `workflow_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Security
    - Enable RLS on `transformation_types` table
    - Add policy for public access to transformation types
*/

CREATE TABLE IF NOT EXISTS transformation_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  default_instructions text NOT NULL DEFAULT '',
  filename_template text NOT NULL DEFAULT '',
  field_mappings jsonb DEFAULT '[]'::jsonb,
  auto_detect_instructions text DEFAULT '',
  workflow_id uuid REFERENCES extraction_workflows(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transformation_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to transformation types"
  ON transformation_types
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_transformation_types_workflow_id 
  ON transformation_types(workflow_id);

CREATE INDEX IF NOT EXISTS idx_transformation_types_user_id 
  ON transformation_types(user_id);