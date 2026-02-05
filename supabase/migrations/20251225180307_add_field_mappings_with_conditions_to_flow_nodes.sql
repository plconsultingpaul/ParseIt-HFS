/*
  # Add Field Mappings with Conditional Application to Execute Button Flow Nodes

  This migration adds support for conditional field mappings in execute button flow nodes,
  allowing Form Group fields to be pre-populated conditionally based on which edge path
  (success/failure) was taken to reach the node.

  ## Problem
  When using User Confirmation steps with Yes/No branches, both paths may lead to the same
  Form Group node. Previously, field mappings were applied unconditionally, meaning AI-populated
  data would always fill the form even when the user clicked "No".

  ## Solution
  Add a `field_mappings` column that stores field mappings with apply conditions:
  - `always`: Apply mapping regardless of path (default)
  - `on_success`: Only apply when reaching node via success/yes edge
  - `on_failure`: Only apply when reaching node via failure/no edge

  ## Changes
  1. New Column
    - `field_mappings` (jsonb) - Stores field mapping configurations with conditions
      Structure: `{ "fieldKey": { "variablePath": "path.to.variable", "applyCondition": "always|on_success|on_failure" } }`

  ## Example Usage
  For a User Confirmation asking "Use AI address?":
  - Address fields mapped to AI data with condition: "on_success"
  - If user clicks Yes → fields pre-populate with AI data
  - If user clicks No → fields remain empty for manual entry
*/

-- Add field_mappings column to execute_button_flow_nodes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'execute_button_flow_nodes' AND column_name = 'field_mappings'
  ) THEN
    ALTER TABLE execute_button_flow_nodes ADD COLUMN field_mappings jsonb DEFAULT NULL;
    COMMENT ON COLUMN execute_button_flow_nodes.field_mappings IS 'Field mapping configurations with conditional application based on edge path taken. Structure: { "fieldKey": { "variablePath": "...", "applyCondition": "always|on_success|on_failure" } }';
  END IF;
END $$;
