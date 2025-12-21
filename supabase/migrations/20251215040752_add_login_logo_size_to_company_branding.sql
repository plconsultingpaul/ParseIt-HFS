/*
  # Add Login Logo Size to Company Branding

  1. Changes
    - Adds `login_logo_size` column to `company_branding` table
    - This controls the logo size specifically on the admin login page
    - Separate from `client_login_logo_size` which affects client login page
    - Default value of 80 pixels (same as client login default)

  2. Notes
    - This setting only affects the login page, not the sidebar
    - Valid range: 32-300 pixels (enforced in UI)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_branding' AND column_name = 'login_logo_size'
  ) THEN
    ALTER TABLE company_branding ADD COLUMN login_logo_size integer DEFAULT 80;
  END IF;
END $$;