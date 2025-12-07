/*
  # Add transformation type support to SFTP polling

  1. Schema Changes
    - Add `default_transformation_type_id` column to `sftp_polling_configs`
    - Add `processing_mode` column to `sftp_polling_configs`
    - Add foreign key constraint for transformation types

  2. Data Migration
    - Set default processing mode to 'extraction' for existing configs
    - Ensure backward compatibility

  3. Constraints
    - Add check constraint for processing_mode values
    - Add foreign key reference to transformation_types table
*/

-- Add new columns to sftp_polling_configs table
DO $$
BEGIN
  -- Add default_transformation_type_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sftp_polling_configs' AND column_name = 'default_transformation_type_id'
  ) THEN
    ALTER TABLE sftp_polling_configs ADD COLUMN default_transformation_type_id uuid;
  END IF;

  -- Add processing_mode column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sftp_polling_configs' AND column_name = 'processing_mode'
  ) THEN
    ALTER TABLE sftp_polling_configs ADD COLUMN processing_mode text DEFAULT 'extraction';
  END IF;
END $$;

-- Add check constraint for processing_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sftp_polling_configs' AND constraint_name = 'sftp_polling_configs_processing_mode_check'
  ) THEN
    ALTER TABLE sftp_polling_configs 
    ADD CONSTRAINT sftp_polling_configs_processing_mode_check 
    CHECK (processing_mode IN ('extraction', 'transformation'));
  END IF;
END $$;

-- Add foreign key constraint for transformation types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'sftp_polling_configs' AND constraint_name = 'sftp_polling_configs_default_transformation_type_id_fkey'
  ) THEN
    ALTER TABLE sftp_polling_configs 
    ADD CONSTRAINT sftp_polling_configs_default_transformation_type_id_fkey 
    FOREIGN KEY (default_transformation_type_id) REFERENCES transformation_types(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Set default processing mode for existing configs
UPDATE sftp_polling_configs 
SET processing_mode = 'extraction' 
WHERE processing_mode IS NULL;