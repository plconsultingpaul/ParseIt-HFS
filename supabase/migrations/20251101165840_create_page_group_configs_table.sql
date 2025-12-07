/*
  # Create page_group_configs table for multi-page group workflow routing

  ## Overview
  This migration creates a new table to support configuring multiple page groups within a single transformation type,
  where each page group can have its own smart detection pattern and workflow assignment.

  ## New Tables
  - `page_group_configs`
    - `id` (uuid, primary key) - Unique identifier for the page group config
    - `transformation_type_id` (uuid, foreign key) - Links to the parent transformation type
    - `group_order` (integer) - Order/priority of this page group (1, 2, 3, etc.)
    - `pages_per_group` (integer) - Maximum number of pages in this group
    - `workflow_id` (uuid, nullable, foreign key) - Assigned workflow for this page group
    - `smart_detection_pattern` (text, nullable) - Text pattern to detect the start of this page group
    - `process_mode` (text) - Either 'single' (process only first page) or 'all' (process all pages up to next boundary)
    - `created_at` (timestamptz) - Record creation timestamp
    - `updated_at` (timestamptz) - Record last update timestamp

  ## Security
  - Enable RLS on `page_group_configs` table
  - Add policies for authenticated users to manage their page group configs

  ## Important Notes
  1. When no page group configs exist for a transformation type, the system falls back to the transformation type's 
     default pagesPerGroup and documentStartPattern settings
  2. The group_order determines the sequence in which page groups are detected
  3. If smart_detection_pattern is null, the system uses fixed page position based on pages_per_group
  4. The process_mode determines whether only the first page or all pages in the group are processed
*/

-- Create page_group_configs table
CREATE TABLE IF NOT EXISTS page_group_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transformation_type_id uuid NOT NULL REFERENCES transformation_types(id) ON DELETE CASCADE,
  group_order integer NOT NULL,
  pages_per_group integer NOT NULL DEFAULT 1,
  workflow_id uuid REFERENCES extraction_workflows(id) ON DELETE SET NULL,
  smart_detection_pattern text,
  process_mode text NOT NULL DEFAULT 'all' CHECK (process_mode IN ('single', 'all')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for efficient lookups by transformation type
CREATE INDEX IF NOT EXISTS idx_page_group_configs_transformation_type 
  ON page_group_configs(transformation_type_id, group_order);

-- Enable Row Level Security
ALTER TABLE page_group_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all page group configs
CREATE POLICY "Authenticated users can view page group configs"
  ON page_group_configs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert page group configs
CREATE POLICY "Authenticated users can insert page group configs"
  ON page_group_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update page group configs
CREATE POLICY "Authenticated users can update page group configs"
  ON page_group_configs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete page group configs
CREATE POLICY "Authenticated users can delete page group configs"
  ON page_group_configs
  FOR DELETE
  TO authenticated
  USING (true);

-- Add constraint to ensure group_order is positive
ALTER TABLE page_group_configs 
  ADD CONSTRAINT check_group_order_positive 
  CHECK (group_order > 0);

-- Add constraint to ensure pages_per_group is positive
ALTER TABLE page_group_configs 
  ADD CONSTRAINT check_pages_per_group_positive 
  CHECK (pages_per_group > 0);

-- Add unique constraint to prevent duplicate group orders within same transformation type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_transformation_type_group_order
  ON page_group_configs(transformation_type_id, group_order);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_page_group_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_page_group_configs_updated_at
  BEFORE UPDATE ON page_group_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_page_group_configs_updated_at();