/*
  # Add operator support to default fields

  1. Changes
    - Add `operator` column to `track_trace_template_default_fields` table
    - Column defaults to 'eq' for backwards compatibility

  2. Purpose
    - Allows default fields to use operators like 'in', 'contains', 'gt', etc.
    - Matches the functionality available in Quick Filter buttons
    - Provides more flexible filtering options for hidden default fields
*/

-- Add operator column to track_trace_template_default_fields
ALTER TABLE track_trace_template_default_fields
ADD COLUMN IF NOT EXISTS operator text DEFAULT 'eq';
