/*
  # Add default_send_from_email column to email_monitoring_config

  1. Schema Changes
    - Add `default_send_from_email` column to `email_monitoring_config` table
    - Column type: text with default empty string
    - Allow null values for backward compatibility

  2. Purpose
    - Provides a default "From" email address for workflow email actions
    - Independent of the monitored email address used for inbox monitoring
    - Ensures proper authorization for sending emails through Office 365/Gmail APIs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'default_send_from_email'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN default_send_from_email text DEFAULT ''::text NOT NULL;
  END IF;
END $$;