/*
  # Add filename_template to page_group_configs table

  ## Overview
  This migration adds a filename_template column to the page_group_configs table to allow
  each page group to specify its own filename template that will be passed to assigned workflows.

  ## Changes
  - Add `filename_template` column (text, nullable) to page_group_configs table
  
  ## Purpose
  When a page group has an assigned workflow, the filename_template (if set) will be passed to
  the workflow and used by SFTP Upload and Email Action steps instead of the transformation
  type's default filename template. This provides more granular control over file naming based
  on the specific page group being processed.

  ## Important Notes
  - This field is optional - if not set, the transformation type's default template will be used
  - The template uses the same placeholder syntax: {{fieldName}}
  - This template is prioritized in workflow steps when available
*/

-- Add filename_template column to page_group_configs
ALTER TABLE page_group_configs 
ADD COLUMN IF NOT EXISTS filename_template text;

-- Add comment explaining the field
COMMENT ON COLUMN page_group_configs.filename_template IS 
'Optional filename template for this page group. When set, this template will be passed to the assigned workflow and used by SFTP/Email actions instead of the transformation type default template. Uses {{fieldName}} placeholder syntax.';