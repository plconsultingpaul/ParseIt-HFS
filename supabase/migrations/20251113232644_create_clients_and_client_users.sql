/*
  # Create Clients Table and Client User Support

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `client_name` (text, required)
      - `client_id` (text, unique, manually entered)
      - `is_active` (boolean, default true)
      - `has_order_entry_access` (boolean, default false)
      - `has_rate_quote_access` (boolean, default false)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modifications to users table
    - Add `client_id` (uuid, foreign key to clients, nullable)
    - Add `is_client_admin` (boolean, default false)
    - Add `has_order_entry_access` (boolean, default false)
    - Add `has_rate_quote_access` (boolean, default false)

  3. Indexes
    - Unique index on clients.client_id for fast lookups and uniqueness
    - Index on users.client_id for fast client user queries

  4. Security
    - Enable RLS on clients table
    - Admins can manage all clients
    - Client users can read their own client data
    - Client admins can read users from their client
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_id text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  has_order_entry_access boolean NOT NULL DEFAULT false,
  has_rate_quote_access boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique index on client_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_client_id ON clients(client_id);

-- Add index on client_name for sorting
CREATE INDEX IF NOT EXISTS idx_clients_client_name ON clients(client_name);

-- Add columns to users table for client association
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE users ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_client_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_client_admin boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'has_order_entry_access'
  ) THEN
    ALTER TABLE users ADD COLUMN has_order_entry_access boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'has_rate_quote_access'
  ) THEN
    ALTER TABLE users ADD COLUMN has_rate_quote_access boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add index on users.client_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);

-- Enable RLS on clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can manage all clients
CREATE POLICY "Admins can manage all clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- RLS Policy: Client users can read their own client data
CREATE POLICY "Client users can read own client data"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.client_id = clients.id
    )
  );