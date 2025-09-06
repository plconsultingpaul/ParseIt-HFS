/*
  # Remove authentication requirements

  1. Changes
    - Remove user_id foreign key constraints
    - Remove RLS policies that require authentication
    - Add simple RLS policies for public access
    - Keep data structure but make it accessible without auth

  2. Security
    - Enable RLS but allow public access
    - This creates a single-user application experience
*/

-- Update extraction_types table
ALTER TABLE extraction_types DROP CONSTRAINT IF EXISTS extraction_types_user_id_fkey;
ALTER TABLE extraction_types ALTER COLUMN user_id DROP NOT NULL;

-- Update sftp_config table  
ALTER TABLE sftp_config DROP CONSTRAINT IF EXISTS sftp_config_user_id_fkey;
ALTER TABLE sftp_config ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can insert own extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can update own extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can delete own extraction types" ON extraction_types;

DROP POLICY IF EXISTS "Users can read own sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can insert own sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can update own sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can delete own sftp config" ON sftp_config;

-- Create public access policies
CREATE POLICY "Allow public read access to extraction types"
  ON extraction_types
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to extraction types"
  ON extraction_types
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to extraction types"
  ON extraction_types
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to extraction types"
  ON extraction_types
  FOR DELETE
  TO public
  USING (true);

CREATE POLICY "Allow public read access to sftp config"
  ON sftp_config
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to sftp config"
  ON sftp_config
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to sftp config"
  ON sftp_config
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to sftp config"
  ON sftp_config
  FOR DELETE
  TO public
  USING (true);

-- Insert default data if tables are empty
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM extraction_types LIMIT 1) THEN
    INSERT INTO extraction_types (name, default_instructions, xml_format, user_id) VALUES
    ('BOL', 'Extract the following information: PICKUP DATE, PO NUMBER, FREIGHT BILL NO, SHIPPER information, CONSIGNEE information, PIECES, DESCRIPTION, WEIGHT, CLASS.', '<?xml version="1.0" encoding="UTF-8"?>
<extraction>
  <document_type>BOL</document_type>
  <pickup_date></pickup_date>
  <po_number></po_number>
  <freight_bill_no></freight_bill_no>
  <shipper>
    <name></name>
    <address></address>
  </shipper>
  <consignee>
    <name></name>
    <address></address>
  </consignee>
  <items>
    <item>
      <description></description>
      <pieces></pieces>
      <weight></weight>
      <class></class>
    </item>
  </items>
</extraction>', null),
    ('Invoice', 'Extract invoice number, date, vendor information, line items with descriptions, quantities, unit prices, and total amount.', '<?xml version="1.0" encoding="UTF-8"?>
<extraction>
  <document_type>Invoice</document_type>
  <invoice_number></invoice_number>
  <invoice_date></invoice_date>
  <vendor>
    <name></name>
    <address></address>
  </vendor>
  <line_items>
    <item>
      <description></description>
      <quantity></quantity>
      <unit_price></unit_price>
      <total></total>
    </item>
  </line_items>
  <total_amount></total_amount>
</extraction>', null);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sftp_config LIMIT 1) THEN
    INSERT INTO sftp_config (host, port, username, password, remote_path, user_id) VALUES
    ('', 22, '', '', '/uploads/xml/', null);
  END IF;
END $$;