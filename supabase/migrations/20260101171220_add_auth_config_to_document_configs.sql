/*
  # Add Authentication Configuration to Document Configs

  1. Changes
    - Add `auth_config_id` column to `track_trace_document_configs` table
    - This column references `api_auth_config` table for Bearer token authentication
    - When fetching documents, the system will use the linked authentication config
      to get a Bearer token before making API calls

  2. Usage
    - Each document configuration can now specify which authentication to use
    - The Search API (API #1) and Get Document API (API #2) will both use the same auth config
    - If no auth_config_id is set, the system falls back to existing api_settings password

  3. Notes
    - Column is optional (nullable) for backward compatibility
    - Foreign key references api_auth_config(id) with ON DELETE SET NULL
*/

-- Add auth_config_id column to track_trace_document_configs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'track_trace_document_configs' AND column_name = 'auth_config_id'
  ) THEN
    ALTER TABLE track_trace_document_configs
    ADD COLUMN auth_config_id uuid REFERENCES api_auth_config(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better join performance
CREATE INDEX IF NOT EXISTS idx_track_trace_document_configs_auth_config_id
  ON track_trace_document_configs(auth_config_id);
