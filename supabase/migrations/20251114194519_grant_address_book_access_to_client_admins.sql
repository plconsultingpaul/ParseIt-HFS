/*
  # Grant Address Book Access to Client Admins

  1. Purpose
    - Automatically grant Address Book access to all existing Client Admin users
    - Ensure Client Admins always have access to the Address Book feature

  2. Changes
    - Update all users where `is_client_admin` is true to have `has_address_book_access` set to true
    - This is a one-time data migration to ensure consistency

  3. Impact
    - Updates existing Client Admin users to have Address Book access
    - Does not affect users who are not Client Admins
    - Preserves existing Address Book access for non-admin users

  4. Notes
    - Client Admins should always have Address Book access at the client level
    - The application UI now automatically grants and enforces this permission
    - This migration ensures historical data is consistent with the new policy
*/

-- Update all Client Admin users to have Address Book access
UPDATE users
SET
  has_address_book_access = true,
  updated_at = now()
WHERE
  is_client_admin = true
  AND role = 'client'
  AND has_address_book_access = false;

-- Log the number of users updated (this will be visible in migration logs)
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM users
  WHERE is_client_admin = true
    AND role = 'client'
    AND has_address_book_access = true;

  RAISE NOTICE 'Total Client Admin users with Address Book access: %', updated_count;
END $$;
