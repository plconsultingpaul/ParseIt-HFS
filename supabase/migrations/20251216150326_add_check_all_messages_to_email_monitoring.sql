/*
  # Add check_all_messages option to email monitoring

  1. Changes
    - Add `check_all_messages` boolean column to `email_monitoring_config` table
    - Default value is `false` to maintain existing behavior
    - When enabled, the email monitor will ignore the last_check timestamp and check all messages

  2. Purpose
    - Allows users to disable the "last check" date filter
    - Useful for ensuring no emails are missed due to timing issues
    - Duplicate emails are automatically skipped via the processed_emails table
*/

ALTER TABLE email_monitoring_config
ADD COLUMN IF NOT EXISTS check_all_messages boolean DEFAULT false;

COMMENT ON COLUMN email_monitoring_config.check_all_messages IS 'When enabled, ignores last_check timestamp and checks all messages. Duplicates are skipped automatically.';
