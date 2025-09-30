/*
  # Add Gmail Support to Email Monitoring

  1. Schema Changes
    - Add `provider` column to choose between 'office365' and 'gmail'
    - Add Gmail-specific configuration fields:
      - `gmail_client_id` (OAuth client ID)
      - `gmail_client_secret` (OAuth client secret)
      - `gmail_refresh_token` (OAuth refresh token for API access)
      - `gmail_monitored_label` (Gmail label/folder to monitor)
    - Add `enable_auto_detect` column for AI auto-detection feature

  2. Security
    - All new columns are nullable to maintain backward compatibility
    - Default provider is 'office365' for existing configurations
*/

-- Add new columns to email_monitoring_config table
DO $$
BEGIN
  -- Add provider column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'provider'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN provider text DEFAULT 'office365' NOT NULL;
  END IF;

  -- Add Gmail client ID
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_client_id'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_client_id text DEFAULT '' NOT NULL;
  END IF;

  -- Add Gmail client secret
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_client_secret'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_client_secret text DEFAULT '' NOT NULL;
  END IF;

  -- Add Gmail refresh token
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_refresh_token'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_refresh_token text DEFAULT '' NOT NULL;
  END IF;

  -- Add Gmail monitored label
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_monitored_label'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_monitored_label text DEFAULT 'INBOX' NOT NULL;
  END IF;

  -- Add enable_auto_detect column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'enable_auto_detect'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN enable_auto_detect boolean DEFAULT false;
  END IF;
END $$;

-- Add check constraint for provider
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'email_monitoring_config' AND constraint_name = 'email_monitoring_config_provider_check'
  ) THEN
    ALTER TABLE email_monitoring_config ADD CONSTRAINT email_monitoring_config_provider_check 
    CHECK (provider IN ('office365', 'gmail'));
  END IF;
END $$;