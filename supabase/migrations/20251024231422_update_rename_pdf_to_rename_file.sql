/*
  # Update rename_pdf step type to rename_file

  1. Changes
    - Adds 'rename_file' to the allowed step_type values
    - Updates all workflow_steps with step_type='rename_pdf' to step_type='rename_file'
    - Adds default file type configuration to existing rename steps
    - Updates config_json to include renamePdf: true for backward compatibility
  
  2. Backward Compatibility
    - Existing rename_pdf steps will have renamePdf set to true by default
    - Template field is preserved and will work with the new logic
    - No breaking changes to existing workflows
  
  3. Security
    - Maintains existing RLS policies on workflow_steps table
    - No changes to access control
*/

-- First, drop the existing check constraint
ALTER TABLE workflow_steps 
DROP CONSTRAINT IF EXISTS workflow_steps_step_type_check;

-- Add the new check constraint with 'rename_file' included
ALTER TABLE workflow_steps
ADD CONSTRAINT workflow_steps_step_type_check 
CHECK (step_type = ANY (ARRAY[
  'api_call'::text, 
  'conditional_check'::text, 
  'data_transform'::text, 
  'sftp_upload'::text, 
  'rename_pdf'::text,
  'rename_file'::text,
  'email_action'::text
]));

-- Update all rename_pdf step types to rename_file
UPDATE workflow_steps
SET step_type = 'rename_file'
WHERE step_type = 'rename_pdf';

-- Update config_json to add default file type selections for backward compatibility
-- This ensures existing steps continue to work by defaulting to PDF renaming
UPDATE workflow_steps
SET config_json = jsonb_set(
  COALESCE(config_json, '{}'::jsonb),
  '{renamePdf}',
  'true'::jsonb
)
WHERE step_type = 'rename_file'
AND NOT (config_json ? 'renamePdf');

-- Initialize other file type flags to false if not present
UPDATE workflow_steps
SET config_json = 
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(config_json, '{}'::jsonb),
        '{renameCsv}',
        COALESCE(config_json->'renameCsv', 'false'::jsonb)
      ),
      '{renameJson}',
      COALESCE(config_json->'renameJson', 'false'::jsonb)
    ),
    '{renameXml}',
    COALESCE(config_json->'renameXml', 'false'::jsonb)
  )
WHERE step_type = 'rename_file'
AND (
  NOT (config_json ? 'renameCsv') OR
  NOT (config_json ? 'renameJson') OR
  NOT (config_json ? 'renameXml')
);