/*
  # Add Follows Previous Group Feature to Page Group Configs

  1. Changes
    - Add `follows_previous_group` column to `page_group_configs` table
      - Type: BOOLEAN
      - Default: FALSE
      - Allows groups to automatically process pages immediately after the previous group
    
  2. Purpose
    - Enables sequential page group processing without Smart Detection
    - Group 2+ can follow Group 1, Group 3 can follow Group 2, etc.
    - When enabled, Smart Detection patterns are not used for that group
    - Process Mode still controls whether single page or all pages are consumed
    
  3. Notes
    - Backward compatible - existing configs default to FALSE
    - Only applicable to groups with groupOrder > 1
    - Mutually exclusive with Smart Detection patterns in practice
*/

-- Add follows_previous_group column to page_group_configs table
ALTER TABLE page_group_configs 
ADD COLUMN IF NOT EXISTS follows_previous_group BOOLEAN DEFAULT FALSE;

-- Add index for performance when querying groups by this flag
CREATE INDEX IF NOT EXISTS idx_page_group_configs_follows_previous 
ON page_group_configs(follows_previous_group) 
WHERE follows_previous_group = TRUE;