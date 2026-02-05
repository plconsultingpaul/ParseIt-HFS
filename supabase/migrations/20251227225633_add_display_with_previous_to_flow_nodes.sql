/*
  # Add Display With Previous to Flow Nodes

  1. Changes
    - Add `display_with_previous` column to `execute_button_flow_nodes` table
    - This allows form groups to be combined and displayed together on the same page
    - Only applicable to nodes with `node_type = 'group'`

  2. Details
    - Column: `display_with_previous` (boolean, default false)
    - When true, the group will be displayed on the same page as the previous group
    - Enables multi-group forms on a single step without changing API endpoint processing
*/

ALTER TABLE execute_button_flow_nodes
ADD COLUMN IF NOT EXISTS display_with_previous boolean DEFAULT false;

COMMENT ON COLUMN execute_button_flow_nodes.display_with_previous IS 'When true, this group node will be displayed together with the previous group on the same page';