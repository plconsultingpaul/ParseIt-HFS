/*
  # Add Separate Email Monitoring Credentials

  This migration adds optional columns for email monitoring credentials separate from sending credentials.
  This allows using different Azure AD app registrations for reading inbox vs sending emails.

  1. Changes
    - Adds `monitoring_tenant_id` (text, nullable) - Optional tenant ID for monitoring
    - Adds `monitoring_client_id` (text, nullable) - Optional client ID for monitoring
    - Adds `monitoring_client_secret` (text, nullable) - Optional client secret for monitoring
    - Adds `gmail_monitoring_client_id` (text, nullable) - Optional Gmail client ID for monitoring
    - Adds `gmail_monitoring_client_secret` (text, nullable) - Optional Gmail client secret for monitoring
    - Adds `gmail_monitoring_refresh_token` (text, nullable) - Optional Gmail refresh token for monitoring

  2. Backward Compatibility
    - All new columns are nullable with empty string defaults
    - Existing setups continue working - email-monitor falls back to send credentials when monitoring columns are empty
    - Workflow email steps are UNCHANGED - they continue using existing columns

  3. Security
    - No changes to RLS policies (table already has RLS enabled)
*/

DO $$
BEGIN
  -- Add Office 365 monitoring-specific credentials
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'monitoring_tenant_id'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN monitoring_tenant_id text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'monitoring_client_id'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN monitoring_client_id text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'monitoring_client_secret'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN monitoring_client_secret text DEFAULT '' NOT NULL;
  END IF;

  -- Add Gmail monitoring-specific credentials
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_monitoring_client_id'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_monitoring_client_id text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_monitoring_client_secret'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_monitoring_client_secret text DEFAULT '' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'gmail_monitoring_refresh_token'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN gmail_monitoring_refresh_token text DEFAULT '' NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN email_monitoring_config.monitoring_tenant_id IS 'Optional separate tenant ID for email monitoring. If empty, falls back to tenant_id (send credentials).';
COMMENT ON COLUMN email_monitoring_config.monitoring_client_id IS 'Optional separate client ID for email monitoring. If empty, falls back to client_id (send credentials).';
COMMENT ON COLUMN email_monitoring_config.monitoring_client_secret IS 'Optional separate client secret for email monitoring. If empty, falls back to client_secret (send credentials).';
COMMENT ON COLUMN email_monitoring_config.gmail_monitoring_client_id IS 'Optional separate Gmail client ID for monitoring. If empty, falls back to gmail_client_id (send credentials).';
COMMENT ON COLUMN email_monitoring_config.gmail_monitoring_client_secret IS 'Optional separate Gmail client secret for monitoring. If empty, falls back to gmail_client_secret (send credentials).';
COMMENT ON COLUMN email_monitoring_config.gmail_monitoring_refresh_token IS 'Optional separate Gmail refresh token for monitoring. If empty, falls back to gmail_refresh_token (send credentials).';