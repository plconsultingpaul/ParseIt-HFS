/*
  # Add Client Login Logo Support to Company Branding

  1. Changes
    - Add `client_login_logo_url` column for separate logo on client login page
    - Add `client_login_logo_size` column to control logo size (height in pixels)

  2. New Columns
    - `client_login_logo_url` (text, nullable) - URL for the client login page logo
    - `client_login_logo_size` (integer, default 80) - Logo height in pixels

  3. Notes
    - When client_login_logo_url is null, the main logo_url will be used as fallback
    - Size is specified in pixels and applies to the logo height
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_branding' AND column_name = 'client_login_logo_url'
  ) THEN
    ALTER TABLE company_branding ADD COLUMN client_login_logo_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_branding' AND column_name = 'client_login_logo_size'
  ) THEN
    ALTER TABLE company_branding ADD COLUMN client_login_logo_size integer DEFAULT 80;
  END IF;
END $$;
