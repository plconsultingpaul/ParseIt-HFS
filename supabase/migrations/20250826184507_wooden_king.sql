/*
  # Create ParseIt application tables

  1. New Tables
    - `extraction_types`
      - `id` (uuid, primary key)
      - `name` (text, extraction type name)
      - `default_instructions` (text, default extraction instructions)
      - `xml_format` (text, XML format template)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `sftp_config`
      - `id` (uuid, primary key)
      - `host` (text, SFTP host)
      - `port` (integer, SFTP port)
      - `username` (text, SFTP username)
      - `password` (text, encrypted SFTP password)
      - `remote_path` (text, remote directory path)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Create extraction_types table
CREATE TABLE IF NOT EXISTS extraction_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_instructions text NOT NULL,
  xml_format text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sftp_config table
CREATE TABLE IF NOT EXISTS sftp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 22,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  remote_path text NOT NULL DEFAULT '/uploads/xml/',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE extraction_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE sftp_config ENABLE ROW LEVEL SECURITY;

-- Create policies for extraction_types
CREATE POLICY "Users can read own extraction types"
  ON extraction_types
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extraction types"
  ON extraction_types
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extraction types"
  ON extraction_types
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own extraction types"
  ON extraction_types
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for sftp_config
CREATE POLICY "Users can read own sftp config"
  ON sftp_config
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sftp config"
  ON sftp_config
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sftp config"
  ON sftp_config
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sftp config"
  ON sftp_config
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert default extraction types for new users
INSERT INTO extraction_types (name, default_instructions, xml_format, user_id)
SELECT 
  'BOL',
  'Extract the following information: PICKUP DATE, PO NUMBER, FREIGHT BILL NO, SHIPPER information, CONSIGNEE information, PIECES, DESCRIPTION, WEIGHT, CLASS.',
  '<?xml version="1.0" encoding="UTF-8"?>
<bol>
  <pickup_date>{pickup_date}</pickup_date>
  <po_number>{po_number}</po_number>
  <freight_bill_no>{freight_bill_no}</freight_bill_no>
  <shipper>
    <name>{shipper_name}</name>
    <address>{shipper_address}</address>
  </shipper>
  <consignee>
    <name>{consignee_name}</name>
    <address>{consignee_address}</address>
  </consignee>
  <items>
    <item>
      <pieces>{pieces}</pieces>
      <description>{description}</description>
      <weight>{weight}</weight>
      <class>{class}</class>
    </item>
  </items>
</bol>',
  auth.uid()
WHERE NOT EXISTS (
  SELECT 1 FROM extraction_types WHERE user_id = auth.uid()
);

INSERT INTO extraction_types (name, default_instructions, xml_format, user_id)
SELECT 
  'Invoice',
  'Extract invoice number, date, vendor information, customer information, line items with descriptions, quantities, unit prices, and total amount.',
  '<?xml version="1.0" encoding="UTF-8"?>
<invoice>
  <invoice_number>{invoice_number}</invoice_number>
  <date>{date}</date>
  <vendor>
    <name>{vendor_name}</name>
    <address>{vendor_address}</address>
  </vendor>
  <customer>
    <name>{customer_name}</name>
    <address>{customer_address}</address>
  </customer>
  <line_items>
    <item>
      <description>{description}</description>
      <quantity>{quantity}</quantity>
      <unit_price>{unit_price}</unit_price>
      <total>{total}</total>
    </item>
  </line_items>
  <total_amount>{total_amount}</total_amount>
</invoice>',
  auth.uid()
WHERE NOT EXISTS (
  SELECT 1 FROM extraction_types WHERE user_id = auth.uid() AND name = 'Invoice'
);