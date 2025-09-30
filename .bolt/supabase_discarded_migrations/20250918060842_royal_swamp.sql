/*
  # Create vendor_extraction_rules table

  1. New Tables
    - `vendor_extraction_rules`
      - `id` (uuid, primary key)
      - `vendor_id` (uuid, foreign key to users)
      - `rule_name` (text)
      - `auto_detect_instructions` (text)
      - `extraction_type_id` (uuid, foreign key to extraction_types)
      - `transformation_type_id` (uuid, foreign key to transformation_types)
      - `processing_mode` (text, 'extraction' or 'transformation')
      - `priority` (integer)
      - `is_enabled` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `vendor_extraction_rules` table
    - Add policy for public access to vendor extraction rules
*/

CREATE TABLE IF NOT EXISTS vendor_extraction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  rule_name text NOT NULL DEFAULT '',
  auto_detect_instructions text NOT NULL DEFAULT '',
  extraction_type_id uuid,
  transformation_type_id uuid,
  processing_mode text NOT NULL DEFAULT 'extraction',
  priority integer NOT NULL DEFAULT 1,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT vendor_extraction_rules_processing_mode_check 
    CHECK (processing_mode IN ('extraction', 'transformation')),
  CONSTRAINT vendor_extraction_rules_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT vendor_extraction_rules_extraction_type_id_fkey 
    FOREIGN KEY (extraction_type_id) REFERENCES extraction_types(id) ON DELETE SET NULL,
  CONSTRAINT vendor_extraction_rules_transformation_type_id_fkey 
    FOREIGN KEY (transformation_type_id) REFERENCES transformation_types(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendor_extraction_rules_vendor_id 
  ON vendor_extraction_rules(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_extraction_rules_priority 
  ON vendor_extraction_rules(vendor_id, priority);
CREATE INDEX IF NOT EXISTS idx_vendor_extraction_rules_enabled 
  ON vendor_extraction_rules(is_enabled);

-- Enable RLS
ALTER TABLE vendor_extraction_rules ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow public access to vendor extraction rules"
  ON vendor_extraction_rules
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);