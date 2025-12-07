/*
  # Add Trading Partner Support to API Specs

  ## Overview
  This migration adds support for the trading_partner_id pattern used in the working application
  while maintaining backward compatibility with the existing api_endpoint_id/secondary_api_id pattern.

  ## Changes

  1. **api_specs table**
     - Add `trading_partner_id` column (text, nullable)
     - Modify CHECK constraint to allow either pattern:
       - trading_partner_id alone OR
       - api_endpoint_id alone OR
       - secondary_api_id alone

  2. **api_spec_endpoints table**
     - Add `api_endpoint_id` column (text, nullable) to track which API endpoint each spec endpoint belongs to
     - Add index on api_endpoint_id for performance

  ## Migration Safety
  - All columns are nullable to avoid breaking existing data
  - CHECK constraint is modified to be more flexible
  - Existing data remains valid under new constraint

  ## Notes
  - This allows the same schema to work for both the trading partner context pattern
    and the base/secondary API pattern
  - Queries should filter appropriately based on which context is being used
*/

-- Add trading_partner_id to api_specs table
ALTER TABLE api_specs ADD COLUMN IF NOT EXISTS trading_partner_id text;

-- Drop the old CHECK constraint
ALTER TABLE api_specs DROP CONSTRAINT IF EXISTS api_specs_api_reference_check;

-- Add new flexible CHECK constraint that allows any of the three patterns
ALTER TABLE api_specs ADD CONSTRAINT api_specs_api_reference_check CHECK (
  (trading_partner_id IS NOT NULL) OR
  (api_endpoint_id IS NOT NULL) OR
  (secondary_api_id IS NOT NULL)
);

-- Add index on trading_partner_id for performance
CREATE INDEX IF NOT EXISTS idx_api_specs_trading_partner ON api_specs(trading_partner_id);

-- Add api_endpoint_id to api_spec_endpoints table to track which API endpoint each spec endpoint belongs to
ALTER TABLE api_spec_endpoints ADD COLUMN IF NOT EXISTS api_endpoint_id text;

-- Add index on api_endpoint_id for performance
CREATE INDEX IF NOT EXISTS idx_api_spec_endpoints_api_endpoint ON api_spec_endpoints(api_endpoint_id);
