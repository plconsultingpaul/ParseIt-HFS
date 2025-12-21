/*
  # Add emails_failed column to email_polling_logs

  1. Changes
    - Add `emails_failed` column to `email_polling_logs` table
    - Default value of 0 for existing and new records

  2. Purpose
    - Track how many emails failed processing during each polling attempt
    - Provides visibility into processing failures in the Email Polling Activity UI
*/

ALTER TABLE email_polling_logs
ADD COLUMN IF NOT EXISTS emails_failed integer DEFAULT 0;