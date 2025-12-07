/*
  # Add logo storage path to company branding

  1. Changes
    - Add `logo_storage_path` column to `company_branding` table
    - This column will store the Supabase Storage path for uploaded logo files
    - Allows tracking of uploaded logos for future cleanup operations
  
  2. Notes
    - Column is nullable to maintain backward compatibility with external URLs
    - Existing records will have NULL for this field if using external URLs
*/

-- Add logo_storage_path column to company_branding table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_branding' AND column_name = 'logo_storage_path'
  ) THEN
    ALTER TABLE company_branding ADD COLUMN logo_storage_path text;
  END IF;
END $$;