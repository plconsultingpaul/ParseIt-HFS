/*
  # Add Conditional Logic to Array Entry Builder

  1. Changes
    - Adds `conditions` JSONB column to `extraction_type_array_entries` table
    - This column stores conditional logic to determine when an array entry should be included

  2. Column Structure
    - conditions: JSONB with structure:
      {
        "enabled": boolean,
        "logic": "AND" | "OR",
        "rules": [
          {
            "fieldPath": string (e.g., "details.dangerousGoods"),
            "operator": string (e.g., "equals", "greaterThan"),
            "value": string
          }
        ]
      }

  3. Behavior
    - NULL or conditions.enabled = false: Entry is always included (existing behavior)
    - conditions.enabled = true with rules: Entry is only included if conditions pass
*/

ALTER TABLE extraction_type_array_entries
ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT NULL;

COMMENT ON COLUMN extraction_type_array_entries.conditions IS 'Optional conditional logic to determine when this array entry should be included. When null or disabled, entry is always included.';
