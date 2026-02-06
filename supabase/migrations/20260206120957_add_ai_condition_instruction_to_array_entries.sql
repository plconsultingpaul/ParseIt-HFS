/*
  # Add AI Condition Instruction to Array Entries

  1. Modified Tables
    - `extraction_type_array_entries`
      - `ai_condition_instruction` (text) - Free-text AI instruction for conditional inclusion of static array entries.
        Allows users to describe a condition visible on the PDF (even if not a mapped field) that determines
        whether this array entry should be included. Example: "Only include if Temperature Required is Yes"

  2. Important Notes
    - This is separate from the existing field-based `conditions` column which evaluates post-extraction mapped fields
    - This new column is evaluated by the AI during extraction, allowing conditions based on any visible PDF content
    - Primarily used for non-repeating (static) entries since repeating entries already have `repeat_instruction`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extraction_type_array_entries' AND column_name = 'ai_condition_instruction'
  ) THEN
    ALTER TABLE extraction_type_array_entries ADD COLUMN ai_condition_instruction text;
  END IF;
END $$;
