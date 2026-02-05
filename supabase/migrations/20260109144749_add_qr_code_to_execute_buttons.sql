/*
  # Add QR Code Support to Execute Buttons

  1. Changes
    - Add `qr_code_enabled` boolean column to `execute_buttons` table (default false)
    - Add `qr_code_slug` unique text column for URL identifier

  2. Notes
    - QR code slug is auto-generated UUID when QR code is enabled
    - Slug is unique to ensure no URL collisions
*/

ALTER TABLE execute_buttons
ADD COLUMN IF NOT EXISTS qr_code_enabled boolean DEFAULT false;

ALTER TABLE execute_buttons
ADD COLUMN IF NOT EXISTS qr_code_slug text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_execute_buttons_qr_code_slug 
ON execute_buttons(qr_code_slug) 
WHERE qr_code_slug IS NOT NULL;