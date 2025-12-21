/*
  # Add Track & Trace and Invoice Access Features

  1. Changes to users table
    - Add `has_track_trace_access` (boolean, default false) - Controls access to Track & Trace feature
    - Add `has_invoice_access` (boolean, default false) - Controls access to Invoice feature

  2. Changes to clients table
    - Add `has_track_trace_access` (boolean, default false) - Enables Track & Trace feature for the client
    - Add `has_invoice_access` (boolean, default false) - Enables Invoice feature for the client

  3. Notes
    - These columns follow the existing pattern for feature access control
    - Client-level flags enable the feature for the organization
    - User-level flags grant individual access within the organization
*/

-- Add columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'has_track_trace_access'
  ) THEN
    ALTER TABLE users ADD COLUMN has_track_trace_access boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'has_invoice_access'
  ) THEN
    ALTER TABLE users ADD COLUMN has_invoice_access boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add columns to clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'has_track_trace_access'
  ) THEN
    ALTER TABLE clients ADD COLUMN has_track_trace_access boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'has_invoice_access'
  ) THEN
    ALTER TABLE clients ADD COLUMN has_invoice_access boolean NOT NULL DEFAULT false;
  END IF;
END $$;