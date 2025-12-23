/*
  # Add Display Type and Value Mappings to Trace Numbers Configuration

  1. Changes
    - Adds displayType ('header' or 'detail') to trace number field mappings
    - Adds valueMappings array to support value transformations (e.g., B → BOL, P → PO)
    - Updates existing configurations to set first field as 'header' and rest as 'detail'
    - Ensures backward compatibility with existing configurations

  2. Details
    - Display Type:
      - 'header': Field displays with colored badge (only one field can be header)
      - 'detail': Field displays as plain black text
    - Value Mappings:
      - Allows mapping source values to display values
      - Example: traceType 'B' displays as 'BOL', 'P' displays as 'PO'

  Note: This migration updates the JSONB config field in track_trace_template_sections table
*/

-- Update existing trace number configurations to add displayType and valueMappings
DO $$
DECLARE
  section_record RECORD;
  field_mappings JSONB;
  updated_mappings JSONB := '[]'::JSONB;
  field_mapping JSONB;
  field_index INTEGER := 0;
BEGIN
  FOR section_record IN
    SELECT id, config
    FROM track_trace_template_sections
    WHERE section_type = 'trace_numbers'
      AND config ? 'fieldMappings'
  LOOP
    field_mappings := section_record.config->'fieldMappings';
    updated_mappings := '[]'::JSONB;
    field_index := 0;

    FOR field_mapping IN SELECT * FROM jsonb_array_elements(field_mappings)
    LOOP
      -- Add displayType: first field is 'header', rest are 'detail'
      -- Add empty valueMappings array if not present
      updated_mappings := updated_mappings || jsonb_build_array(
        field_mapping
        || jsonb_build_object(
          'displayType', CASE WHEN field_index = 0 THEN 'header' ELSE 'detail' END,
          'valueMappings', COALESCE(field_mapping->'valueMappings', '[]'::JSONB)
        )
      );
      field_index := field_index + 1;
    END LOOP;

    -- Update the section config with new field mappings
    UPDATE track_trace_template_sections
    SET config = jsonb_set(
      section_record.config,
      '{fieldMappings}',
      updated_mappings
    )
    WHERE id = section_record.id;
  END LOOP;
END $$;
