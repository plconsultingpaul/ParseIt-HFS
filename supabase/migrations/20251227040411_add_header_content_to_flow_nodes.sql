/*
  # Add Header Content to Flow Nodes

  1. Changes
    - Add `header_content` column to `execute_button_flow_nodes` table
    - This column stores a template string for instructional text that can include variable placeholders
    - Variables are inserted using {{variable.path}} syntax and resolved at runtime

  2. Purpose
    - Allows admins to add contextual instructions/notes to form groups
    - Instructions can include dynamic values from previous workflow steps
    - Displayed to users when filling out form groups during execution
*/

ALTER TABLE execute_button_flow_nodes
ADD COLUMN IF NOT EXISTS header_content text;

COMMENT ON COLUMN execute_button_flow_nodes.header_content IS 'Template text with optional {{variable}} placeholders for instructional headers on form groups';
