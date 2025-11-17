/*
  # Add Single Quote Escaping Option to Workflow Steps

  1. Changes
    - Add `escape_single_quotes_in_body` column to `workflow_steps` table
      - Type: boolean
      - Default: false
      - Purpose: Enable escaping of single quotes (') to double single quotes ('') in API request body for OData filter compatibility

  2. Notes
    - This is an optional feature that workflow steps can enable when using OData $filter syntax
    - When enabled, placeholder values containing single quotes will be escaped before insertion into API request body
    - Example: "O'Hare" becomes "O''Hare" for proper OData filter syntax
*/

-- Add escape_single_quotes_in_body column to workflow_steps table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workflow_steps' AND column_name = 'escape_single_quotes_in_body'
  ) THEN
    ALTER TABLE workflow_steps ADD COLUMN escape_single_quotes_in_body BOOLEAN DEFAULT false;
  END IF;
END $$;