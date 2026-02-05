/*
  # Link Order Entry Templates to Extraction Types

  1. Changes
    - Add `extraction_type_id` column to `order_entry_templates` table
    - Creates foreign key reference to `extraction_types` table
    - Remove `workflow_id` column (no longer needed - uses extraction type's workflow)

  2. Purpose
    - Order Entry data can now be processed using existing Extraction Type configurations
    - Extraction Types already have JSON Template, Field Mappings, and Workflow
    - This eliminates duplicate configuration and creates a single source of truth
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_entry_templates' AND column_name = 'extraction_type_id'
  ) THEN
    ALTER TABLE order_entry_templates ADD COLUMN extraction_type_id uuid REFERENCES extraction_types(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_entry_templates_extraction_type_id ON order_entry_templates(extraction_type_id);