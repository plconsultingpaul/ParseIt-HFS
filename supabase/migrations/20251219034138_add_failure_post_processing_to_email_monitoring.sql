/*
  # Add Failure Post-Processing to Email Monitoring

  1. Changes
    - Add `post_process_action_on_failure` column to `email_monitoring_config` table
      - Enum type with values: 'none', 'mark_read', 'move', 'archive', 'delete'
      - Default: 'none'
    - Add `failure_folder_path` column to `email_monitoring_config` table
      - Used when post_process_action_on_failure is 'move'
      - Optional text field

  2. Purpose
    - Allow different post-processing actions for successful vs failed email processing
    - Enables moving failed emails to a separate folder for manual review
    - Improves email management and troubleshooting workflow
*/

-- Add post_process_action_on_failure column
ALTER TABLE email_monitoring_config
ADD COLUMN IF NOT EXISTS post_process_action_on_failure text DEFAULT 'none'
CHECK (post_process_action_on_failure IN ('none', 'mark_read', 'move', 'archive', 'delete'));

-- Add failure_folder_path column
ALTER TABLE email_monitoring_config
ADD COLUMN IF NOT EXISTS failure_folder_path text;
