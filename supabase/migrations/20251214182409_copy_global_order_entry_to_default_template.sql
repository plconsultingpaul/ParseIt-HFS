/*
  # Copy Existing Order Entry Configuration to Default Template

  1. Purpose
    - Create a "Default Template" from existing global order entry configuration
    - Preserves all existing field groups, fields, and layouts
    - Allows users to assign this template to clients without losing current setup

  2. What This Migration Does
    - Creates a new template called "Default Template" if it doesn't exist
    - Copies all field groups from order_entry_field_groups to order_entry_template_field_groups
    - Copies all fields from order_entry_fields to order_entry_template_fields
    - Copies all layouts from order_entry_field_layout to order_entry_template_field_layout
    - Maps old IDs to new IDs to maintain field-to-group relationships

  3. Important Notes
    - This migration only runs if there are existing field groups to copy
    - If a "Default Template" already exists, it will not duplicate it
    - The original global configuration remains intact
*/

DO $$
DECLARE
  v_template_id uuid;
  v_group_record record;
  v_field_record record;
  v_layout_record record;
  v_new_group_id uuid;
  v_new_field_id uuid;
  v_group_id_map jsonb := '{}'::jsonb;
  v_field_id_map jsonb := '{}'::jsonb;
  v_has_global_config boolean;
BEGIN
  -- Check if there's any existing global configuration to copy
  SELECT EXISTS (SELECT 1 FROM order_entry_field_groups) INTO v_has_global_config;

  IF NOT v_has_global_config THEN
    RAISE NOTICE 'No global order entry configuration found. Skipping template creation.';
    RETURN;
  END IF;

  -- Check if Default Template already exists
  SELECT id INTO v_template_id 
  FROM order_entry_templates 
  WHERE name = 'Default Template'
  LIMIT 1;

  IF v_template_id IS NOT NULL THEN
    RAISE NOTICE 'Default Template already exists with ID: %. Skipping.', v_template_id;
    RETURN;
  END IF;

  -- Create the Default Template
  INSERT INTO order_entry_templates (name, description, is_active, created_at, updated_at)
  VALUES (
    'Default Template',
    'Default template created from existing global configuration',
    true,
    now(),
    now()
  )
  RETURNING id INTO v_template_id;

  RAISE NOTICE 'Created Default Template with ID: %', v_template_id;

  -- Copy field groups and build ID mapping
  FOR v_group_record IN 
    SELECT * FROM order_entry_field_groups ORDER BY group_order
  LOOP
    INSERT INTO order_entry_template_field_groups (
      template_id,
      group_name,
      group_order,
      description,
      is_collapsible,
      is_expanded_by_default,
      background_color,
      border_color,
      is_array_group,
      array_min_rows,
      array_max_rows,
      array_json_path,
      created_at,
      updated_at
    ) VALUES (
      v_template_id,
      v_group_record.group_name,
      v_group_record.group_order,
      v_group_record.description,
      v_group_record.is_collapsible,
      v_group_record.is_expanded_by_default,
      v_group_record.background_color,
      v_group_record.border_color,
      COALESCE(v_group_record.is_array_group, false),
      COALESCE(v_group_record.array_min_rows, 1),
      COALESCE(v_group_record.array_max_rows, 10),
      v_group_record.array_json_path,
      now(),
      now()
    )
    RETURNING id INTO v_new_group_id;

    -- Store mapping of old ID to new ID
    v_group_id_map := v_group_id_map || jsonb_build_object(v_group_record.id::text, v_new_group_id::text);
    
    RAISE NOTICE 'Copied group "%" (old: %, new: %)', v_group_record.group_name, v_group_record.id, v_new_group_id;
  END LOOP;

  -- Copy fields and build ID mapping
  FOR v_field_record IN 
    SELECT * FROM order_entry_fields ORDER BY field_order
  LOOP
    -- Get the new group ID from our mapping
    INSERT INTO order_entry_template_fields (
      template_id,
      field_group_id,
      field_name,
      field_label,
      field_type,
      placeholder,
      help_text,
      is_required,
      max_length,
      min_value,
      max_value,
      default_value,
      dropdown_options,
      json_path,
      is_array_field,
      array_min_rows,
      array_max_rows,
      ai_extraction_instructions,
      validation_regex,
      validation_error_message,
      field_order,
      created_at,
      updated_at
    ) VALUES (
      v_template_id,
      (v_group_id_map->>v_field_record.field_group_id::text)::uuid,
      v_field_record.field_name,
      v_field_record.field_label,
      v_field_record.field_type,
      v_field_record.placeholder,
      v_field_record.help_text,
      v_field_record.is_required,
      v_field_record.max_length,
      v_field_record.min_value,
      v_field_record.max_value,
      v_field_record.default_value,
      v_field_record.dropdown_options,
      v_field_record.json_path,
      COALESCE(v_field_record.is_array_field, false),
      COALESCE(v_field_record.array_min_rows, 1),
      COALESCE(v_field_record.array_max_rows, 10),
      v_field_record.ai_extraction_instructions,
      v_field_record.validation_regex,
      v_field_record.validation_error_message,
      v_field_record.field_order,
      now(),
      now()
    )
    RETURNING id INTO v_new_field_id;

    -- Store mapping of old ID to new ID
    v_field_id_map := v_field_id_map || jsonb_build_object(v_field_record.id::text, v_new_field_id::text);
    
    RAISE NOTICE 'Copied field "%" (old: %, new: %)', v_field_record.field_label, v_field_record.id, v_new_field_id;
  END LOOP;

  -- Copy layouts using the field ID mapping
  FOR v_layout_record IN 
    SELECT * FROM order_entry_field_layout
  LOOP
    -- Only copy if we have a mapping for this field
    IF v_field_id_map ? v_layout_record.field_id::text THEN
      INSERT INTO order_entry_template_field_layout (
        template_id,
        field_id,
        row_index,
        column_index,
        width_columns,
        mobile_width_columns,
        created_at,
        updated_at
      ) VALUES (
        v_template_id,
        (v_field_id_map->>v_layout_record.field_id::text)::uuid,
        v_layout_record.row_index,
        v_layout_record.column_index,
        v_layout_record.width_columns,
        v_layout_record.mobile_width_columns,
        now(),
        now()
      );
      
      RAISE NOTICE 'Copied layout for field ID: %', v_layout_record.field_id;
    END IF;
  END LOOP;

  RAISE NOTICE 'Successfully created Default Template with all field groups, fields, and layouts.';
END $$;
