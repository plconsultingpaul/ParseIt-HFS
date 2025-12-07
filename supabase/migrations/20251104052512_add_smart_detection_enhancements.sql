/*
  # Add Smart Detection Enhancements to Page Group Configs

  1. New Columns
    - `use_ai_detection` (boolean, default false)
      - When true, use AI-powered pattern matching instead of simple text search
      - Allows natural language patterns and semantic understanding
    
    - `fallback_behavior` (text, default 'skip')
      - Options: 'skip', 'fixed_position', 'error'
      - Controls what happens when smart detection pattern is not found
      - 'skip': Skip this group (current behavior)
      - 'fixed_position': Use fixed position grouping as fallback
      - 'error': Stop processing and show error
    
    - `detection_confidence_threshold` (numeric, default 0.7)
      - Minimum AI confidence score (0.0 to 1.0) required for a match
      - Only used when use_ai_detection is true

  2. Changes
    - These enhancements make smart detection more flexible and intelligent
    - Backwards compatible - existing configs will use simple text search
*/

-- Add use_ai_detection column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_group_configs' AND column_name = 'use_ai_detection'
  ) THEN
    ALTER TABLE page_group_configs ADD COLUMN use_ai_detection boolean DEFAULT false;
  END IF;
END $$;

-- Add fallback_behavior column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_group_configs' AND column_name = 'fallback_behavior'
  ) THEN
    ALTER TABLE page_group_configs ADD COLUMN fallback_behavior text DEFAULT 'skip';
  END IF;
END $$;

-- Add detection_confidence_threshold column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'page_group_configs' AND column_name = 'detection_confidence_threshold'
  ) THEN
    ALTER TABLE page_group_configs ADD COLUMN detection_confidence_threshold numeric DEFAULT 0.7;
  END IF;
END $$;

-- Add check constraint for fallback_behavior
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'page_group_configs_fallback_behavior_check'
  ) THEN
    ALTER TABLE page_group_configs
    ADD CONSTRAINT page_group_configs_fallback_behavior_check
    CHECK (fallback_behavior IN ('skip', 'fixed_position', 'error'));
  END IF;
END $$;

-- Add check constraint for detection_confidence_threshold
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'page_group_configs_confidence_threshold_check'
  ) THEN
    ALTER TABLE page_group_configs
    ADD CONSTRAINT page_group_configs_confidence_threshold_check
    CHECK (detection_confidence_threshold >= 0 AND detection_confidence_threshold <= 1);
  END IF;
END $$;
