/*
  # Gemini API Configuration System

  ## Overview
  Creates a comprehensive system for managing multiple Gemini API keys and models dynamically.
  This allows administrators to quickly switch between different API keys and models without code changes.

  ## New Tables

  ### `gemini_api_keys`
  Stores multiple Gemini API keys with friendly names
  - `id` (uuid, primary key) - Unique identifier
  - `name` (text) - Friendly name for the key (e.g., "Primary Key", "Backup Key")
  - `api_key` (text) - The actual Gemini API key (plaintext, visible to admins)
  - `is_active` (boolean) - Whether this key is currently in use globally (only one can be active)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `gemini_models`
  Stores models associated with each API key
  - `id` (uuid, primary key) - Unique identifier
  - `api_key_id` (uuid, foreign key) - References gemini_api_keys
  - `model_name` (text) - Technical model name (e.g., "gemini-1.5-flash")
  - `display_name` (text) - Friendly display name
  - `is_active` (boolean) - Whether this model is currently in use globally (only one can be active)
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Business Rules
  - Only ONE API key can have is_active=true at any time
  - Only ONE model can have is_active=true at any time
  - When a key is set to active, all other keys become inactive
  - When a model is set to active, all other models become inactive
  - Models are associated with their parent API key
  - Deleting a key cascades to delete its associated models

  ## Security
  - Enable RLS on both tables
  - Only admins can manage API keys and models
  - Read access for authenticated users to retrieve active configuration

  ## Initial Data
  - Seeds the database with current API key from api_settings.google_api_key if it exists
  - Creates default models: gemini-1.5-flash, gemini-2.0-flash-exp, gemini-2.5-pro
  - Sets gemini-2.5-pro as the active model by default
*/

-- Create gemini_api_keys table
CREATE TABLE IF NOT EXISTS gemini_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create gemini_models table
CREATE TABLE IF NOT EXISTS gemini_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES gemini_api_keys(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  display_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_gemini_api_keys_active ON gemini_api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_gemini_models_active ON gemini_models(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_gemini_models_api_key_id ON gemini_models(api_key_id);

-- Enable RLS
ALTER TABLE gemini_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE gemini_models ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gemini_api_keys
-- Admins can do everything
CREATE POLICY "Admins can manage Gemini API keys"
  ON gemini_api_keys
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- All authenticated users can read active configuration
CREATE POLICY "Authenticated users can read active Gemini API key"
  ON gemini_api_keys
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies for gemini_models
-- Admins can do everything
CREATE POLICY "Admins can manage Gemini models"
  ON gemini_models
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );

-- All authenticated users can read active configuration
CREATE POLICY "Authenticated users can read active Gemini model"
  ON gemini_models
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Function to ensure only one active API key
CREATE OR REPLACE FUNCTION ensure_single_active_api_key()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other keys
    UPDATE gemini_api_keys 
    SET is_active = false, updated_at = now()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure only one active model
CREATE OR REPLACE FUNCTION ensure_single_active_model()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Deactivate all other models
    UPDATE gemini_models 
    SET is_active = false, updated_at = now()
    WHERE id != NEW.id AND is_active = true;
  END IF;
  
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to enforce single active key/model
DROP TRIGGER IF EXISTS trigger_ensure_single_active_api_key ON gemini_api_keys;
CREATE TRIGGER trigger_ensure_single_active_api_key
  BEFORE INSERT OR UPDATE ON gemini_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_api_key();

DROP TRIGGER IF EXISTS trigger_ensure_single_active_model ON gemini_models;
CREATE TRIGGER trigger_ensure_single_active_model
  BEFORE INSERT OR UPDATE ON gemini_models
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_active_model();

-- Seed data: Import existing API key from api_settings if it exists
DO $$
DECLARE
  existing_key text;
  new_key_id uuid;
BEGIN
  -- Get existing API key from api_settings
  SELECT google_api_key INTO existing_key 
  FROM api_settings 
  LIMIT 1;
  
  IF existing_key IS NOT NULL AND existing_key != '' THEN
    -- Insert the existing key as "Default Key"
    INSERT INTO gemini_api_keys (name, api_key, is_active)
    VALUES ('Default Key', existing_key, true)
    RETURNING id INTO new_key_id;
    
    -- Add common Gemini models for this key
    INSERT INTO gemini_models (api_key_id, model_name, display_name, is_active)
    VALUES 
      (new_key_id, 'gemini-1.5-flash', 'Gemini 1.5 Flash', false),
      (new_key_id, 'gemini-2.0-flash-exp', 'Gemini 2.0 Flash (Experimental)', false),
      (new_key_id, 'gemini-2.5-pro', 'Gemini 2.5 Pro', true);
    
    RAISE NOTICE 'Migrated existing Gemini API key and created default models';
  ELSE
    RAISE NOTICE 'No existing Gemini API key found in api_settings';
  END IF;
END $$;
