/*
  # Add Invitation Email Tracking to Users Table

  1. Changes
    - Add `invitation_sent_at` column to track when the last invitation email was sent
    - Add `invitation_sent_count` column to track how many times invitation emails were sent
    
  2. Purpose
    - Enable admins to see when and if invitation emails were sent to users
    - Track multiple resends to identify potential email delivery issues
    - Provide visibility into the user onboarding process
    
  3. Details
    - `invitation_sent_at`: timestamptz, nullable - timestamp of last invitation email
    - `invitation_sent_count`: integer, default 0 - number of times invitation email was sent
*/

-- Add invitation email tracking columns to users table
DO $$
BEGIN
  -- Add invitation_sent_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'invitation_sent_at'
  ) THEN
    ALTER TABLE users ADD COLUMN invitation_sent_at timestamptz;
  END IF;

  -- Add invitation_sent_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'invitation_sent_count'
  ) THEN
    ALTER TABLE users ADD COLUMN invitation_sent_count integer DEFAULT 0;
  END IF;
END $$;
