/*
  # Add AI Auto-Detect to Email Monitoring Configuration

  1. Schema Changes
    - Add `enable_auto_detect` column to `email_monitoring_config` table
    - Default value is `false` to maintain existing behavior

  2. Security
    - No RLS changes needed (table already has appropriate policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'enable_auto_detect'
  ) THEN
    ALTER TABLE email_monitoring_config ADD COLUMN enable_auto_detect boolean DEFAULT false;
  END IF;
END $$;