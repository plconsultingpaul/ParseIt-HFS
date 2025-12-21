/*
  # Add Client Login Company Name Field

  1. Changes
    - Add `client_login_company_name` column to `company_branding` table
    - This field stores a separate company name specifically for the client login page
    - If this field is empty/null, the client login page will show no company name (blank)

  2. Notes
    - This is an optional field (nullable)
    - Existing records will have NULL for this field
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_branding' AND column_name = 'client_login_company_name'
  ) THEN
    ALTER TABLE company_branding ADD COLUMN client_login_company_name text;
  END IF;
END $$;
