/*
  # Add Hide Add Row Option to Order Entry Field Groups

  1. Changes
    - Add `hide_add_row` boolean column to `order_entry_template_field_groups` table
    - This allows array groups to be configured as fixed single-row arrays
    - When enabled, the "Add Row" button is hidden on the client Order Entry page
    - Users can still have array data structure for API submission without allowing row additions

  2. Column Details
    - `hide_add_row` (boolean, default: false) - When true, hides the Add Row button for array groups
*/

ALTER TABLE order_entry_template_field_groups
ADD COLUMN IF NOT EXISTS hide_add_row boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN order_entry_template_field_groups.hide_add_row IS 'When true, hides the Add Row button for array groups on the Order Entry page';