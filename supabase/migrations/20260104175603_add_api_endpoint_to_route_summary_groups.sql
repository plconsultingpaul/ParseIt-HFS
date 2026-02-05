/*
  # Add API Endpoint Configuration to Route Summary Groups

  This migration adds the ability to configure separate API endpoints for each
  Route Summary group, allowing data to be fetched from different endpoints
  like /orders/{orderId}/shipper, /orders/{orderId}/consignee, etc.

  1. New Columns Added to `track_trace_route_summary_groups`:
    - `api_spec_endpoint_id` (uuid, nullable) - Reference to the API endpoint to fetch data from
    - `api_source_type` (text, default 'main') - Whether to use main API or secondary API
    - `secondary_api_id` (uuid, nullable) - Reference to secondary API config if using secondary
    - `auth_config_id` (uuid, nullable) - Reference to authentication configuration

  2. Foreign Keys:
    - Links to api_spec_endpoints table for endpoint selection
    - Links to secondary_api_configs table for secondary API selection
    - Links to api_auth_config table for authentication

  3. Notes:
    - If api_spec_endpoint_id is NULL, the group will use data from the main shipment fetch
    - If api_spec_endpoint_id is set, data will be fetched from that endpoint and merged
*/

ALTER TABLE track_trace_route_summary_groups
ADD COLUMN IF NOT EXISTS api_spec_endpoint_id uuid REFERENCES api_spec_endpoints(id) ON DELETE SET NULL;

ALTER TABLE track_trace_route_summary_groups
ADD COLUMN IF NOT EXISTS api_source_type text DEFAULT 'main';

ALTER TABLE track_trace_route_summary_groups
ADD COLUMN IF NOT EXISTS secondary_api_id uuid REFERENCES secondary_api_configs(id) ON DELETE SET NULL;

ALTER TABLE track_trace_route_summary_groups
ADD COLUMN IF NOT EXISTS auth_config_id uuid REFERENCES api_auth_config(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_route_summary_groups_api_endpoint 
ON track_trace_route_summary_groups(api_spec_endpoint_id);

CREATE INDEX IF NOT EXISTS idx_route_summary_groups_secondary_api 
ON track_trace_route_summary_groups(secondary_api_id);

CREATE INDEX IF NOT EXISTS idx_route_summary_groups_auth_config 
ON track_trace_route_summary_groups(auth_config_id);

COMMENT ON COLUMN track_trace_route_summary_groups.api_spec_endpoint_id IS 'API endpoint to fetch data for this group (e.g., /orders/{orderId}/shipper)';
COMMENT ON COLUMN track_trace_route_summary_groups.api_source_type IS 'API source type: main or secondary';
COMMENT ON COLUMN track_trace_route_summary_groups.secondary_api_id IS 'Secondary API config ID if using secondary API';
COMMENT ON COLUMN track_trace_route_summary_groups.auth_config_id IS 'Authentication configuration ID for API calls';