/*
  # Create Client Addresses Table

  1. New Tables
    - `client_addresses`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients, required)
      - `name` (varchar(40), required)
      - `address_1` (varchar(40), required)
      - `address_2` (varchar(40), optional)
      - `city` (varchar(30), required)
      - `state_prov` (varchar(4), required)
      - `country` (char(2), required)
      - `contact_name` (varchar(128), optional)
      - `contact_email` (varchar(40), optional)
      - `contact_phone` (varchar(20), optional)
      - `contact_phone_ext` (varchar(5), optional)
      - `appointment_req` (char(5), default 'false')
      - `active` (char(5), default 'true')
      - `is_shipper` (char(5), default 'false')
      - `is_consignee` (char(5), default 'false')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modifications to existing tables
    - Add `has_address_book_access` column to clients table
    - Add `has_address_book_access` column to users table

  3. Indexes
    - Index on client_addresses.client_id for fast client filtering
    - Index on client_addresses.active for filtering active addresses
    - Index on client_addresses.name for sorting and searching

  4. Security
    - Enable RLS on client_addresses table
    - Policy: Client users can manage their own client's addresses
    - Policy: Admin users can view all addresses
    - Policy: Admins can manage all addresses

  Important Notes:
    - All addresses are scoped to a specific client
    - Clients can only access their own addresses
    - Phone numbers are stored in formatted form (111-111-1111)
    - Boolean values stored as 'true'/'false' strings in CHAR(5) fields
    - Country code is 2-character code (US, CA)
*/

-- Create client_addresses table
CREATE TABLE IF NOT EXISTS client_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name varchar(40) NOT NULL,
  address_1 varchar(40) NOT NULL,
  address_2 varchar(40) DEFAULT '',
  city varchar(30) NOT NULL,
  state_prov varchar(4) NOT NULL,
  country char(2) NOT NULL DEFAULT 'US',
  contact_name varchar(128) DEFAULT '',
  contact_email varchar(40) DEFAULT '',
  contact_phone varchar(20) DEFAULT '',
  contact_phone_ext varchar(5) DEFAULT '',
  appointment_req char(5) NOT NULL DEFAULT 'false',
  active char(5) NOT NULL DEFAULT 'true',
  is_shipper char(5) NOT NULL DEFAULT 'false',
  is_consignee char(5) NOT NULL DEFAULT 'false',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_active ON client_addresses(active);
CREATE INDEX IF NOT EXISTS idx_client_addresses_name ON client_addresses(name);
CREATE INDEX IF NOT EXISTS idx_client_addresses_is_shipper ON client_addresses(is_shipper);
CREATE INDEX IF NOT EXISTS idx_client_addresses_is_consignee ON client_addresses(is_consignee);

-- Add has_address_book_access to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'has_address_book_access'
  ) THEN
    ALTER TABLE clients ADD COLUMN has_address_book_access boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add has_address_book_access to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'has_address_book_access'
  ) THEN
    ALTER TABLE users ADD COLUMN has_address_book_access boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Enable RLS on client_addresses table
ALTER TABLE client_addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Client users can view addresses for their own client
CREATE POLICY "Client users can view own client addresses"
  ON client_addresses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.client_id = client_addresses.client_id
      AND users.role = 'client'
    )
  );

-- RLS Policy: Client users can insert addresses for their own client
CREATE POLICY "Client users can insert own client addresses"
  ON client_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.client_id = client_addresses.client_id
      AND users.role = 'client'
    )
  );

-- RLS Policy: Client users can update addresses for their own client
CREATE POLICY "Client users can update own client addresses"
  ON client_addresses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.client_id = client_addresses.client_id
      AND users.role = 'client'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.client_id = client_addresses.client_id
      AND users.role = 'client'
    )
  );

-- RLS Policy: Client users can delete addresses for their own client
CREATE POLICY "Client users can delete own client addresses"
  ON client_addresses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.client_id = client_addresses.client_id
      AND users.role = 'client'
    )
  );

-- RLS Policy: Admin users can manage all addresses
CREATE POLICY "Admins can manage all addresses"
  ON client_addresses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );
