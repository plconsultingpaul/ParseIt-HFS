/*
  # Add Token Field Name to API Auth Config

  1. Changes
    - Add `token_field_name` column to `api_auth_config` table
    - Default value is 'access_token' to maintain backward compatibility
    - This allows users to specify the exact field name the API returns for the token

  2. Purpose
    - Different APIs return tokens with different field names (e.g., access_token, token, accessToken)
    - This field allows configuration of the expected token field name in the login response
*/

-- Add token_field_name column to api_auth_config table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_auth_config' AND column_name = 'token_field_name'
  ) THEN
    ALTER TABLE api_auth_config ADD COLUMN token_field_name text NOT NULL DEFAULT 'access_token';
  END IF;
END $$;
