/*
  # Add Email Post-Processing Action Settings

  1. New Columns on `email_monitoring_config`
    - `post_process_action` (text) - Action to take after processing an email
      - Values: 'mark_read' (default), 'move', 'archive', 'delete', 'none'
    - `processed_folder_path` (text) - Target folder path when action is 'move'

  2. Purpose
    - Allows users to configure what happens to emails after they are processed
    - Prevents reprocessing by filtering only unread emails
    - Default is 'mark_read' which marks emails as read after processing

  3. Security
    - No changes to RLS policies (existing policies apply)
*/

-- Add post_process_action column with default 'mark_read'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'post_process_action'
  ) THEN
    ALTER TABLE email_monitoring_config 
    ADD COLUMN post_process_action text NOT NULL DEFAULT 'mark_read';
  END IF;
END $$;

-- Add processed_folder_path column for 'move' action
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_monitoring_config' AND column_name = 'processed_folder_path'
  ) THEN
    ALTER TABLE email_monitoring_config 
    ADD COLUMN processed_folder_path text DEFAULT 'Processed';
  END IF;
END $$;

-- Add check constraint to ensure valid post_process_action values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'email_monitoring_config' AND constraint_name = 'email_monitoring_config_post_process_action_check'
  ) THEN
    ALTER TABLE email_monitoring_config 
    ADD CONSTRAINT email_monitoring_config_post_process_action_check 
    CHECK (post_process_action IN ('mark_read', 'move', 'archive', 'delete', 'none'));
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN email_monitoring_config.post_process_action IS 'Action to take after processing an email: mark_read (default), move, archive, delete, none';
COMMENT ON COLUMN email_monitoring_config.processed_folder_path IS 'Target folder path when post_process_action is move (e.g., Processed, INBOX/Processed)';