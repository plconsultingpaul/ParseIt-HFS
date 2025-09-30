/*
  # Add transformation type support to email processing rules

  1. Schema Changes
    - Add `transformation_type_id` column to link to transformation types
    - Add `processing_mode` column to distinguish between extraction and transformation
    - Add foreign key constraint for transformation types
    - Set default processing mode to 'extraction' for backward compatibility

  2. Data Migration
    - Set all existing rules to 'extraction' mode
    - Ensure existing rules continue to work as before

  3. Constraints
    - Add check constraint for valid processing modes
    - Maintain existing foreign key to extraction types
*/

-- Add new columns to email_processing_rules table
DO $$
BEGIN
  -- Add transformation_type_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_processing_rules' AND column_name = 'transformation_type_id'
  ) THEN
    ALTER TABLE email_processing_rules ADD COLUMN transformation_type_id uuid;
  END IF;

  -- Add processing_mode column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_processing_rules' AND column_name = 'processing_mode'
  ) THEN
    ALTER TABLE email_processing_rules ADD COLUMN processing_mode text DEFAULT 'extraction' NOT NULL;
  END IF;
END $$;

-- Add foreign key constraint for transformation types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'email_processing_rules_transformation_type_id_fkey'
  ) THEN
    ALTER TABLE email_processing_rules 
    ADD CONSTRAINT email_processing_rules_transformation_type_id_fkey 
    FOREIGN KEY (transformation_type_id) REFERENCES transformation_types(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add check constraint for processing_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'email_processing_rules_processing_mode_check'
  ) THEN
    ALTER TABLE email_processing_rules 
    ADD CONSTRAINT email_processing_rules_processing_mode_check 
    CHECK (processing_mode IN ('extraction', 'transformation'));
  END IF;
END $$;

-- Update existing rules to have 'extraction' processing mode (if not already set)
UPDATE email_processing_rules 
SET processing_mode = 'extraction' 
WHERE processing_mode IS NULL OR processing_mode = '';

-- Create index for better performance on processing_mode queries
CREATE INDEX IF NOT EXISTS idx_email_processing_rules_processing_mode 
ON email_processing_rules(processing_mode);

-- Create index for transformation_type_id
CREATE INDEX IF NOT EXISTS idx_email_processing_rules_transformation_type_id 
ON email_processing_rules(transformation_type_id);