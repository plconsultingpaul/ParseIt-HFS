/*
  # Add Secondary Endpoint Support for Barcode Details Configuration

  This migration adds support for a two-API-call pattern for barcode details,
  similar to the Documents section. This allows:
  - API #1: Get order details (returns orderDetailId)
  - API #2: Get barcodes for each detail (uses orderDetailId from API #1)

  1. Changes to `track_trace_barcode_configs`
    - `secondary_endpoint_id` (uuid, nullable) - FK to api_spec_endpoints for the second API
    - `secondary_param_field` (text, nullable) - Field from API #1 response to use in API #2 URL

  2. Security
    - No RLS changes needed (table already has public access policies)
*/

-- Add secondary_endpoint_id column
ALTER TABLE track_trace_barcode_configs
ADD COLUMN IF NOT EXISTS secondary_endpoint_id uuid REFERENCES api_spec_endpoints(id) ON DELETE SET NULL;

-- Add secondary_param_field column
ALTER TABLE track_trace_barcode_configs
ADD COLUMN IF NOT EXISTS secondary_param_field text;

-- Add index for the new foreign key
CREATE INDEX IF NOT EXISTS idx_track_trace_barcode_configs_secondary_endpoint_id 
  ON track_trace_barcode_configs(secondary_endpoint_id);

-- Add comment for documentation
COMMENT ON COLUMN track_trace_barcode_configs.secondary_endpoint_id IS 'Secondary API endpoint for fetching barcode data (API #2)';
COMMENT ON COLUMN track_trace_barcode_configs.secondary_param_field IS 'Field from API #1 response to use as URL parameter in API #2';