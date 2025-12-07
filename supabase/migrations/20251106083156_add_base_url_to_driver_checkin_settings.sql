/*
  # Add base_url to driver_checkin_settings
  
  1. Changes
    - Add `base_url` column to `driver_checkin_settings` table
    - Column is optional (nullable) to maintain backward compatibility
    - When null, system will fall back to window.location.origin
  
  2. Purpose
    - Allows administrators to configure a custom production URL for QR code generation
    - Solves the issue where development URLs (WebContainer) appear in QR codes
*/

-- Add base_url column to driver_checkin_settings table
ALTER TABLE driver_checkin_settings 
ADD COLUMN IF NOT EXISTS base_url text;
