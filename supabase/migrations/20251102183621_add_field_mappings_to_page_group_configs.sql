/*
  # Add field_mappings to page_group_configs table

  ## Overview
  This migration adds field mapping support to page group configurations, allowing each page group 
  to have its own independent field mappings that completely replace the transformation type's 
  field mappings for that specific group.

  ## Changes
  - Add `field_mappings` column to `page_group_configs` table
    - Stores JSONB array of field mapping configurations
    - Each mapping includes: fieldName, type (ai/mapped/hardcoded), value, dataType, maxLength, pageNumberInGroup
    - Nullable for backward compatibility with existing page group configs

  ## Field Mapping Structure
  - `fieldName` (string) - The name of the field to extract
  - `type` (string) - One of: 'ai', 'mapped', 'hardcoded'
  - `value` (string) - The extraction prompt, mapping path, or hardcoded value
  - `dataType` (string) - Optional: 'string', 'number', 'integer', 'datetime', 'phone', 'boolean'
  - `maxLength` (number) - Optional: Maximum length for the field
  - `pageNumberInGroup` (number) - Optional: Which page within the group to extract from

  ## Important Notes
  1. When a page group has field_mappings defined, they completely replace the transformation 
     type's field mappings for that specific page group
  2. If field_mappings is null or empty, the system falls back to the transformation type's 
     default field mappings
  3. The pageNumberInGroup property references pages within the specific page group boundary, 
     not the entire document
*/

-- Add field_mappings column to page_group_configs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_group_configs' AND column_name = 'field_mappings'
  ) THEN
    ALTER TABLE page_group_configs ADD COLUMN field_mappings jsonb DEFAULT NULL;
    COMMENT ON COLUMN page_group_configs.field_mappings IS 'Field mapping configurations for this page group. When set, completely replaces transformation type field mappings.';
  END IF;
END $$;