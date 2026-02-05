/*
  # Create Array Entry Configuration System

  This migration adds support for configuring multiple array entries with mixed
  hardcoded and extracted values. This solves the problem of needing to create
  multiple array entries (like traceNumbers) where each entry has a different
  hardcoded value (traceType) and different extracted values (traceNumber from
  different PDF locations).

  1. New Tables
    - `extraction_type_array_entries`
      - `id` (uuid, primary key)
      - `extraction_type_id` (uuid, foreign key to extraction_types)
      - `target_array_field` (text) - The JSON path to the array field (e.g., "traceNumbers")
      - `entry_order` (integer) - Order of this entry in the array
      - `is_enabled` (boolean) - Whether this entry is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `extraction_type_array_entry_fields`
      - `id` (uuid, primary key)
      - `array_entry_id` (uuid, foreign key to extraction_type_array_entries)
      - `field_name` (text) - Field name within the array entry (e.g., "traceType", "traceNumber")
      - `field_type` (text) - "hardcoded" or "extracted"
      - `hardcoded_value` (text) - The static value for hardcoded fields
      - `extraction_instruction` (text) - AI instruction for extracted fields
      - `data_type` (text) - string, number, integer, etc.
      - `field_order` (integer)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated and anon access (matching existing extraction_types patterns)

  3. Indexes
    - Index on extraction_type_id for efficient lookups
    - Index on array_entry_id for efficient field lookups
*/

-- Create the array entries table
CREATE TABLE IF NOT EXISTS extraction_type_array_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_type_id uuid NOT NULL REFERENCES extraction_types(id) ON DELETE CASCADE,
  target_array_field text NOT NULL,
  entry_order integer NOT NULL DEFAULT 1,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create the array entry fields table
CREATE TABLE IF NOT EXISTS extraction_type_array_entry_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  array_entry_id uuid NOT NULL REFERENCES extraction_type_array_entries(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('hardcoded', 'extracted')),
  hardcoded_value text,
  extraction_instruction text,
  data_type text DEFAULT 'string',
  field_order integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE extraction_type_array_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_type_array_entry_fields ENABLE ROW LEVEL SECURITY;

-- RLS Policies for extraction_type_array_entries
CREATE POLICY "Allow public read access to array entries"
  ON extraction_type_array_entries
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to array entries"
  ON extraction_type_array_entries
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to array entries"
  ON extraction_type_array_entries
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from array entries"
  ON extraction_type_array_entries
  FOR DELETE
  TO public
  USING (true);

-- RLS Policies for extraction_type_array_entry_fields
CREATE POLICY "Allow public read access to array entry fields"
  ON extraction_type_array_entry_fields
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to array entry fields"
  ON extraction_type_array_entry_fields
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to array entry fields"
  ON extraction_type_array_entry_fields
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from array entry fields"
  ON extraction_type_array_entry_fields
  FOR DELETE
  TO public
  USING (true);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_array_entries_extraction_type_id 
  ON extraction_type_array_entries(extraction_type_id);

CREATE INDEX IF NOT EXISTS idx_array_entry_fields_array_entry_id 
  ON extraction_type_array_entry_fields(array_entry_id);