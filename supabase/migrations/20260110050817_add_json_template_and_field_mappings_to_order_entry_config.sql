/*
  # Add JSON Template and Field Mappings to Order Entry Config

  1. Changes
    - Adds `json_template` (text) column to store the JSON template for order submissions
    - Adds `field_mappings` (jsonb) column to store field mapping configurations
    - These columns enable workflow-based processing of order entry submissions
    - The API endpoint, method, and auth fields will no longer be used as submissions
      will be processed through workflows instead

  2. Purpose
    - Order entry submissions will now use a JSON template with field mappings
    - Field mappings allow mapping customer-entered form fields to JSON template placeholders
    - This aligns with the Extraction Types pattern for consistency

  3. Notes
    - Existing API configuration columns are retained for backward compatibility
    - The workflow_id field remains for workflow processing
*/

ALTER TABLE order_entry_config
ADD COLUMN IF NOT EXISTS json_template text,
ADD COLUMN IF NOT EXISTS field_mappings jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN order_entry_config.json_template IS 'JSON template for order submission payload';
COMMENT ON COLUMN order_entry_config.field_mappings IS 'Field mappings configuration array for mapping form fields to JSON template';