/*
  # Add Attachment Count and PDF Filenames to Processed Emails

  1. New Columns
    - `attachment_count` (integer) - Number of PDF attachments in the email
    - `pdf_filenames` (text) - Comma-separated list of all PDF filenames

  2. Purpose
    - Enable visibility into multi-attachment emails
    - Display all processed filenames instead of just the first one
*/

ALTER TABLE processed_emails
ADD COLUMN IF NOT EXISTS attachment_count integer DEFAULT 0;

ALTER TABLE processed_emails
ADD COLUMN IF NOT EXISTS pdf_filenames text;