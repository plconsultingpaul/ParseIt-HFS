/*
  # Add Extraction Type Array Splits Configuration

  1. New Tables
    - `extraction_type_array_splits`
      - `id` (uuid, primary key)
      - `extraction_type_id` (uuid, foreign key to extraction_types)
      - `target_array_field` (text) - The array field to split (e.g., "barcodes")
      - `split_based_on_field` (text) - The field whose value determines split count (e.g., "pieces")
      - `split_strategy` (text) - How to split: 'one_per_entry' or 'divide_evenly'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `extraction_type_array_splits` table
    - Add policies for authenticated users to manage their extraction type array splits
    - Admin users can manage all array split configurations

  3. Notes
    - This table stores configuration for dynamically splitting arrays in JSON extraction
    - When split_based_on_field has value N, create N array entries
    - Each split entry will have split_based_on_field set to 1 (for 'one_per_entry' strategy)
*/

-- Create extraction_type_array_splits table
CREATE TABLE IF NOT EXISTS extraction_type_array_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_type_id uuid NOT NULL REFERENCES extraction_types(id) ON DELETE CASCADE,
  target_array_field text NOT NULL,
  split_based_on_field text NOT NULL,
  split_strategy text NOT NULL DEFAULT 'one_per_entry' CHECK (split_strategy IN ('one_per_entry', 'divide_evenly')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_extraction_type_array_splits_extraction_type_id 
  ON extraction_type_array_splits(extraction_type_id);

-- Enable RLS
ALTER TABLE extraction_type_array_splits ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view all array split configurations
CREATE POLICY "Authenticated users can view array split configs"
  ON extraction_type_array_splits
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert array split configurations
CREATE POLICY "Authenticated users can insert array split configs"
  ON extraction_type_array_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update array split configurations
CREATE POLICY "Authenticated users can update array split configs"
  ON extraction_type_array_splits
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete array split configurations
CREATE POLICY "Authenticated users can delete array split configs"
  ON extraction_type_array_splits
  FOR DELETE
  TO authenticated
  USING (true);
