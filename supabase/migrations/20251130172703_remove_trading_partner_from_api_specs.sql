/*
  # Remove Trading Partner References from API Specs

  ## Overview
  This migration removes the trading_partner_id pattern that was incorrectly added to the API Specs system.
  API Specs should only be attached to Base API Endpoints or Secondary API Endpoints, not trading partners.

  ## Changes

  1. **api_specs table**
     - Remove `trading_partner_id` column
     - Restore original CHECK constraint (XOR pattern: api_endpoint_id OR secondary_api_id, not both)
     - Remove trading_partner_id index

  2. **api_spec_endpoints table**
     - Remove `api_endpoint_id` column (not needed - spec endpoints only need api_spec_id)
     - Remove api_endpoint_id index

  ## Migration Safety
  - Uses IF EXISTS clauses to prevent errors
  - All operations are reversible if needed
  - Data integrity maintained through proper constraint restoration

  ## Notes
  - API Specs are global configuration items attached to either Base API or Secondary APIs
  - No trading partner context is needed for API specifications
*/

-- Drop indexes first
DROP INDEX IF EXISTS idx_api_specs_trading_partner;
DROP INDEX IF EXISTS idx_api_spec_endpoints_api_endpoint;

-- Drop the flexible CHECK constraint that allowed trading partners
ALTER TABLE api_specs DROP CONSTRAINT IF EXISTS api_specs_api_reference_check;

-- Remove trading_partner_id column from api_specs
ALTER TABLE api_specs DROP COLUMN IF EXISTS trading_partner_id;

-- Restore original CHECK constraint (XOR: exactly one of api_endpoint_id or secondary_api_id must be NOT NULL)
ALTER TABLE api_specs ADD CONSTRAINT api_specs_api_reference_check CHECK (
  (api_endpoint_id IS NOT NULL AND secondary_api_id IS NULL) OR
  (api_endpoint_id IS NULL AND secondary_api_id IS NOT NULL)
);

-- Remove api_endpoint_id column from api_spec_endpoints (not needed)
ALTER TABLE api_spec_endpoints DROP COLUMN IF EXISTS api_endpoint_id;
