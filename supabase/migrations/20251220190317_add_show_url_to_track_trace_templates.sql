/*
  # Add Show URL debugging option to Track & Trace templates

  1. Changes
    - Add `show_url` boolean column to `track_trace_templates` table
    - Default value is `false` (disabled)
    
  2. Purpose
    - When enabled, displays the full API URL on the client Track & Trace page
    - Helps with testing and debugging API configuration
*/

ALTER TABLE track_trace_templates
ADD COLUMN IF NOT EXISTS show_url boolean NOT NULL DEFAULT false;
