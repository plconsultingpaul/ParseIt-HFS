/*
  # Move Color from Field Mappings to Value Mappings in Trace Numbers

  1. Changes
    - Removes 'color' property from trace number field mappings
    - Adds 'color' property to each value mapping within valueMappings array
    - Migrates existing color values to all value mappings in each field
    - Sets default 'gray' color for value mappings without color

  2. Migration Logic
    - For each field with color AND value mappings: apply field color to all its value mappings
    - For fields with color but NO value mappings: remove the color (won't be used)
    - For value mappings without color: set default 'gray' color
    - Remove color property from field mapping level

  3. Impact
    - More flexible: different values of same field can have different colors
    - Better visual distinction between trace number types
    - Color becomes part of the value transformation logic
*/

DO $$
DECLARE
  section_record RECORD;
  field_mappings JSONB;
  updated_mappings JSONB := '[]'::JSONB;
  field_mapping JSONB;
  field_color TEXT;
  value_mappings JSONB;
  updated_value_mappings JSONB;
  value_mapping JSONB;
BEGIN
  FOR section_record IN
    SELECT id, config
    FROM track_trace_template_sections
    WHERE section_type = 'trace_numbers'
      AND config ? 'fieldMappings'
  LOOP
    field_mappings := section_record.config->'fieldMappings';
    updated_mappings := '[]'::JSONB;

    FOR field_mapping IN SELECT * FROM jsonb_array_elements(field_mappings)
    LOOP
      -- Get the color from field mapping (if exists)
      field_color := field_mapping->>'color';
      value_mappings := field_mapping->'valueMappings';
      updated_value_mappings := '[]'::JSONB;

      -- Process value mappings if they exist
      IF value_mappings IS NOT NULL AND jsonb_array_length(value_mappings) > 0 THEN
        FOR value_mapping IN SELECT * FROM jsonb_array_elements(value_mappings)
        LOOP
          -- Add color to each value mapping
          -- Use existing color from value mapping, or field color, or default 'gray'
          updated_value_mappings := updated_value_mappings || jsonb_build_array(
            value_mapping || jsonb_build_object(
              'color', COALESCE(value_mapping->>'color', field_color, 'gray')
            )
          );
        END LOOP;
      END IF;

      -- Build updated field mapping WITHOUT color property
      -- Only include valueMappings if they exist
      IF updated_value_mappings IS NOT NULL AND jsonb_array_length(updated_value_mappings) > 0 THEN
        updated_mappings := updated_mappings || jsonb_build_array(
          jsonb_build_object(
            'label', field_mapping->'label',
            'valueField', field_mapping->'valueField',
            'displayType', field_mapping->'displayType',
            'valueMappings', updated_value_mappings
          )
        );
      ELSE
        -- No value mappings, just copy without color
        updated_mappings := updated_mappings || jsonb_build_array(
          jsonb_build_object(
            'label', field_mapping->'label',
            'valueField', field_mapping->'valueField',
            'displayType', field_mapping->'displayType',
            'valueMappings', '[]'::JSONB
          )
        );
      END IF;
    END LOOP;

    -- Update the section config with new field mappings
    UPDATE track_trace_template_sections
    SET config = jsonb_set(
      section_record.config,
      '{fieldMappings}',
      updated_mappings
    ),
    updated_at = now()
    WHERE id = section_record.id;
  END LOOP;
END $$;
