/*
  # Field Mapping Functions System

  1. New Tables
    - `field_mapping_functions`
      - `id` (uuid, primary key)
      - `extraction_type_id` (uuid, references extraction_types)
      - `function_name` (text, unique per extraction type)
      - `description` (text, optional)
      - `function_logic` (jsonb) - stores conditions and default value
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes
    - No changes to existing tables needed
    - Field mappings will reference functions via function_id in their config

  3. Security
    - Enable RLS on `field_mapping_functions` table
    - Add policies for authenticated users to manage their functions
    - Public read access for function evaluation during workflow execution

  4. Performance
    - Add index on extraction_type_id for faster lookups
    - Add unique constraint on (extraction_type_id, function_name)
*/

-- Create field_mapping_functions table
CREATE TABLE IF NOT EXISTS field_mapping_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_type_id uuid REFERENCES extraction_types(id) ON DELETE CASCADE,
  function_name text NOT NULL,
  description text,
  function_logic jsonb NOT NULL DEFAULT '{"conditions": [], "default": null}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_function_name_per_type UNIQUE (extraction_type_id, function_name)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_field_mapping_functions_extraction_type 
  ON field_mapping_functions(extraction_type_id);

-- Enable RLS
ALTER TABLE field_mapping_functions ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read all functions
CREATE POLICY "Authenticated users can read all functions"
  ON field_mapping_functions
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for authenticated users to insert functions
CREATE POLICY "Authenticated users can insert functions"
  ON field_mapping_functions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy for authenticated users to update functions
CREATE POLICY "Authenticated users can update functions"
  ON field_mapping_functions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users to delete functions
CREATE POLICY "Authenticated users can delete functions"
  ON field_mapping_functions
  FOR DELETE
  TO authenticated
  USING (true);

-- Policy for public (anon) to read functions for workflow execution
CREATE POLICY "Public can read functions for execution"
  ON field_mapping_functions
  FOR SELECT
  TO anon
  USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_field_mapping_functions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_field_mapping_functions_updated_at_trigger
  BEFORE UPDATE ON field_mapping_functions
  FOR EACH ROW
  EXECUTE FUNCTION update_field_mapping_functions_updated_at();