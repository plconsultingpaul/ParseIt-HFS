/*
  # Create Driver Check-In System Tables

  ## Summary
  This migration creates the complete database schema for the Driver Check-In system,
  enabling drivers to check in via mobile devices, scan BOL documents, and track all
  check-in activities with comprehensive logging and document management.

  ## New Tables

  1. **driver_checkins**
     - Master table storing unique driver information by phone number
     - `id` (uuid, primary key)
     - `phone_number` (text, unique, indexed) - Driver's phone number (unique identifier)
     - `name` (text) - Driver's full name
     - `company` (text) - Driver's company name
     - `created_at` (timestamptz) - First check-in timestamp
     - `updated_at` (timestamptz) - Last update timestamp

  2. **driver_checkin_logs**
     - Records each individual check-in session with full details
     - `id` (uuid, primary key)
     - `driver_checkin_id` (uuid, foreign key) - Reference to driver_checkins
     - `phone_number` (text, indexed) - Phone number for quick lookups
     - `name` (text) - Driver name at time of check-in
     - `company` (text) - Company name at time of check-in
     - `bols_count` (integer) - Number of BOLs expected
     - `door_number` (integer) - Assigned door number
     - `check_in_timestamp` (timestamptz) - When check-in occurred
     - `status` (text) - Status: 'pending', 'scanning', 'processing', 'completed', 'failed'
     - `created_at` (timestamptz)

  3. **driver_checkin_documents**
     - Tracks individual BOL documents uploaded during check-in
     - `id` (uuid, primary key)
     - `driver_checkin_log_id` (uuid, foreign key) - Reference to check-in session
     - `pdf_filename` (text) - Original filename
     - `pdf_storage_path` (text) - Path in Supabase storage
     - `document_order` (integer) - Order in sequence (1st BOL, 2nd BOL, etc.)
     - `extraction_type_id` (uuid, nullable) - Detected extraction type
     - `workflow_id` (uuid, nullable) - Workflow used for processing
     - `processing_status` (text) - Status: 'pending', 'processing', 'completed', 'failed'
     - `error_message` (text, nullable) - Error details if processing failed
     - `extraction_log_id` (uuid, nullable) - Link to extraction_logs table
     - `created_at` (timestamptz)

  4. **driver_checkin_settings**
     - System configuration for driver check-in functionality
     - `id` (uuid, primary key)
     - `fallback_workflow_id` (uuid, nullable) - Workflow to use when AI detection fails
     - `additional_fields` (jsonb) - Custom fields configuration for future extensibility
     - `is_enabled` (boolean) - Enable/disable check-in system
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  ## Security (RLS Policies)

  All tables have Row Level Security enabled with public access policies to allow:
  - Drivers to check in without authentication (via QR code access)
  - System to process and store check-in data
  - Admin interfaces to manage and view data

  ## Indexes

  - Index on `driver_checkins.phone_number` for fast lookups
  - Index on `driver_checkin_logs.phone_number` for filtering
  - Index on `driver_checkin_logs.check_in_timestamp` for date range queries
  - Index on `driver_checkin_documents.driver_checkin_log_id` for joins
  - Foreign key indexes for referential integrity

  ## Initial Data

  - Creates default settings record with check-in system disabled by default
*/

-- Create driver_checkins table
CREATE TABLE IF NOT EXISTS driver_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text UNIQUE NOT NULL,
  name text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on phone_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_driver_checkins_phone_number ON driver_checkins(phone_number);

-- Enable RLS
ALTER TABLE driver_checkins ENABLE ROW LEVEL SECURITY;

-- Create policies for driver_checkins
CREATE POLICY "Allow public read access to driver_checkins"
  ON driver_checkins
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to driver_checkins"
  ON driver_checkins
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to driver_checkins"
  ON driver_checkins
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from driver_checkins"
  ON driver_checkins
  FOR DELETE
  TO public
  USING (true);

-- Create driver_checkin_logs table
CREATE TABLE IF NOT EXISTS driver_checkin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_checkin_id uuid REFERENCES driver_checkins(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  name text NOT NULL,
  company text NOT NULL,
  bols_count integer NOT NULL DEFAULT 0,
  door_number integer NOT NULL DEFAULT 0,
  check_in_timestamp timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for driver_checkin_logs
CREATE INDEX IF NOT EXISTS idx_driver_checkin_logs_phone_number ON driver_checkin_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_driver_checkin_logs_timestamp ON driver_checkin_logs(check_in_timestamp);
CREATE INDEX IF NOT EXISTS idx_driver_checkin_logs_driver_id ON driver_checkin_logs(driver_checkin_id);

-- Enable RLS
ALTER TABLE driver_checkin_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for driver_checkin_logs
CREATE POLICY "Allow public read access to driver_checkin_logs"
  ON driver_checkin_logs
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to driver_checkin_logs"
  ON driver_checkin_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to driver_checkin_logs"
  ON driver_checkin_logs
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from driver_checkin_logs"
  ON driver_checkin_logs
  FOR DELETE
  TO public
  USING (true);

-- Create driver_checkin_documents table
CREATE TABLE IF NOT EXISTS driver_checkin_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_checkin_log_id uuid NOT NULL REFERENCES driver_checkin_logs(id) ON DELETE CASCADE,
  pdf_filename text NOT NULL,
  pdf_storage_path text NOT NULL,
  document_order integer NOT NULL DEFAULT 1,
  extraction_type_id uuid,
  workflow_id uuid,
  processing_status text NOT NULL DEFAULT 'pending',
  error_message text,
  extraction_log_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create index for driver_checkin_documents
CREATE INDEX IF NOT EXISTS idx_driver_checkin_documents_log_id ON driver_checkin_documents(driver_checkin_log_id);
CREATE INDEX IF NOT EXISTS idx_driver_checkin_documents_status ON driver_checkin_documents(processing_status);

-- Enable RLS
ALTER TABLE driver_checkin_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for driver_checkin_documents
CREATE POLICY "Allow public read access to driver_checkin_documents"
  ON driver_checkin_documents
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to driver_checkin_documents"
  ON driver_checkin_documents
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to driver_checkin_documents"
  ON driver_checkin_documents
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from driver_checkin_documents"
  ON driver_checkin_documents
  FOR DELETE
  TO public
  USING (true);

-- Create driver_checkin_settings table
CREATE TABLE IF NOT EXISTS driver_checkin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fallback_workflow_id uuid,
  additional_fields jsonb DEFAULT '[]'::jsonb,
  is_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE driver_checkin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for driver_checkin_settings
CREATE POLICY "Allow public read access to driver_checkin_settings"
  ON driver_checkin_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to driver_checkin_settings"
  ON driver_checkin_settings
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to driver_checkin_settings"
  ON driver_checkin_settings
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete from driver_checkin_settings"
  ON driver_checkin_settings
  FOR DELETE
  TO public
  USING (true);

-- Insert default settings record
INSERT INTO driver_checkin_settings (is_enabled, additional_fields)
VALUES (false, '[]'::jsonb)
ON CONFLICT DO NOTHING;