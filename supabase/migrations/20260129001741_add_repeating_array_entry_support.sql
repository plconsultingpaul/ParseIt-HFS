/*
  # Add Repeating Array Entry Support

  This migration adds support for "repeating" array entries that dynamically extract
  multiple rows from PDFs (like line items in a table) where each row creates a
  separate array entry with its own field values.

  1. Changes to `extraction_type_array_entries`
    - `is_repeating` (boolean) - When true, the AI will find ALL matching rows and create an entry for each
    - `repeat_instruction` (text) - AI instruction describing how to identify each row (e.g., "Find all line items where QTY >= 1")

  2. Use Case
    - PDFs with tables of line items (like shipping manifests, invoices)
    - Instead of pre-defining details[1], details[2], etc., mark an entry as "repeating"
    - AI extracts all matching rows dynamically

  3. Important Notes
    - Non-repeating entries work exactly as before (static, pre-defined)
    - Repeating entries ignore entry_order for final position (AI determines count)
    - Field templates in repeating entries apply to EACH extracted row
*/

-- Add is_repeating column with default false (preserves existing behavior)
ALTER TABLE extraction_type_array_entries
ADD COLUMN IF NOT EXISTS is_repeating boolean NOT NULL DEFAULT false;

-- Add repeat_instruction column for AI guidance
ALTER TABLE extraction_type_array_entries
ADD COLUMN IF NOT EXISTS repeat_instruction text;

-- Add comment for documentation
COMMENT ON COLUMN extraction_type_array_entries.is_repeating IS 'When true, AI extracts multiple matching rows from the PDF, creating one array entry per row';
COMMENT ON COLUMN extraction_type_array_entries.repeat_instruction IS 'AI instruction for identifying rows to extract (e.g., "Find all line items where QTY >= 1")';