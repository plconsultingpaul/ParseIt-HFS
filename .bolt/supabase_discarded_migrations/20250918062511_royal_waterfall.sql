/*
  # Add Company Branding Support

  1. New Tables
    - `company_branding`
      - `id` (uuid, primary key)
      - `company_name` (text)
      - `logo_url` (text, optional)
      - `show_company_name` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `company_branding` table
    - Add policy for public access to branding settings
*/

CREATE TABLE IF NOT EXISTS company_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT '',
  logo_url text DEFAULT NULL,
  show_company_name boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE company_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to company branding"
  ON company_branding
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_branding_updated_at ON company_branding(updated_at DESC);

-- Insert default branding record if none exists
INSERT INTO company_branding (company_name, show_company_name)
SELECT '', true
WHERE NOT EXISTS (SELECT 1 FROM company_branding);