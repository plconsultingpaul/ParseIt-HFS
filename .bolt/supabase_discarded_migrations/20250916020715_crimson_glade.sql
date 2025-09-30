/*
  # SFTP Polling System

  1. New Tables
    - `sftp_polling_configs`
      - `id` (uuid, primary key)
      - `name` (text, unique, not null)
      - `host` (text, not null)
      - `port` (integer, default 22)
      - `username` (text, not null)
      - `password` (text, not null)
      - `monitored_path` (text, not null)
      - `processed_path` (text, not null)
      - `is_enabled` (boolean, default true)
      - `last_polled_at` (timestamp with time zone)
      - `default_extraction_type_id` (uuid, foreign key)
      - `workflow_id` (uuid, foreign key)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)
    - `sftp_polling_logs`
      - `id` (uuid, primary key)
      - `config_id` (uuid, foreign key)
      - `timestamp` (timestamp with time zone)
      - `status` (text, check constraint)
      - `files_found` (integer, default 0)
      - `files_processed` (integer, default 0)
      - `error_message` (text)
      - `execution_time_ms` (integer)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on both tables
    - Add policies for public access (matching existing pattern)

  3. Indexes
    - Add performance indexes for common queries
*/

-- Create SFTP polling configurations table
CREATE TABLE IF NOT EXISTS sftp_polling_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 22,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  monitored_path text NOT NULL DEFAULT '/inbox/pdfs/',
  processed_path text NOT NULL DEFAULT '/processed/',
  is_enabled boolean NOT NULL DEFAULT true,
  last_polled_at timestamptz DEFAULT NULL,
  default_extraction_type_id uuid DEFAULT NULL,
  workflow_id uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create SFTP polling logs table
CREATE TABLE IF NOT EXISTS sftp_polling_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL,
  timestamp timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'running',
  files_found integer DEFAULT 0,
  files_processed integer DEFAULT 0,
  error_message text DEFAULT NULL,
  execution_time_ms integer DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sftp_polling_configs_default_extraction_type_id_fkey'
  ) THEN
    ALTER TABLE sftp_polling_configs 
    ADD CONSTRAINT sftp_polling_configs_default_extraction_type_id_fkey 
    FOREIGN KEY (default_extraction_type_id) REFERENCES extraction_types(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sftp_polling_configs_workflow_id_fkey'
  ) THEN
    ALTER TABLE sftp_polling_configs 
    ADD CONSTRAINT sftp_polling_configs_workflow_id_fkey 
    FOREIGN KEY (workflow_id) REFERENCES extraction_workflows(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sftp_polling_logs_config_id_fkey'
  ) THEN
    ALTER TABLE sftp_polling_logs 
    ADD CONSTRAINT sftp_polling_logs_config_id_fkey 
    FOREIGN KEY (config_id) REFERENCES sftp_polling_configs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'sftp_polling_logs_status_check'
  ) THEN
    ALTER TABLE sftp_polling_logs 
    ADD CONSTRAINT sftp_polling_logs_status_check 
    CHECK (status IN ('running', 'success', 'failed'));
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE sftp_polling_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sftp_polling_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sftp_polling_configs
CREATE POLICY "Allow public access to SFTP polling configs"
  ON sftp_polling_configs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for sftp_polling_logs
CREATE POLICY "Allow public access to SFTP polling logs"
  ON sftp_polling_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sftp_polling_configs_enabled 
  ON sftp_polling_configs (is_enabled);

CREATE INDEX IF NOT EXISTS idx_sftp_polling_configs_last_polled 
  ON sftp_polling_configs (last_polled_at);

CREATE INDEX IF NOT EXISTS idx_sftp_polling_logs_config_id 
  ON sftp_polling_logs (config_id);

CREATE INDEX IF NOT EXISTS idx_sftp_polling_logs_timestamp 
  ON sftp_polling_logs (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sftp_polling_logs_status 
  ON sftp_polling_logs (status);