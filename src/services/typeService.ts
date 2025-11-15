import { supabase } from '../lib/supabase';
import type { ExtractionType, TransformationType } from '../types';

// Extraction Types
export async function fetchExtractionTypes(): Promise<ExtractionType[]> {
  try {
    const { data, error } = await supabase
      .from('extraction_types')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const types = data || [];

    // Fetch array split configurations
    const { data: arraySplitData, error: arraySplitError } = await supabase
      .from('extraction_type_array_splits')
      .select('*')
      .order('created_at', { ascending: true });

    if (arraySplitError) {
      console.error('Error fetching array split configs:', arraySplitError);
    }

    // Group array splits by extraction type ID
    const arraySplitsByType = new Map<string, any[]>();
    (arraySplitData || []).forEach(split => {
      if (!arraySplitsByType.has(split.extraction_type_id)) {
        arraySplitsByType.set(split.extraction_type_id, []);
      }
      arraySplitsByType.get(split.extraction_type_id)!.push(split);
    });

    return types.map(type => ({
      id: type.id,
      name: type.name,
      defaultInstructions: type.default_instructions,
      formatTemplate: type.xml_format,
      filename: type.filename,
      formatType: type.format_type as 'XML' | 'JSON' | 'CSV',
      jsonPath: type.json_path,
      fieldMappings: type.field_mappings ? JSON.parse(type.field_mappings) : [],
      parseitIdMapping: type.parseit_id_mapping,
      traceTypeMapping: type.trace_type_mapping,
      traceTypeValue: type.trace_type_value,
      workflowId: type.workflow_id,
      autoDetectInstructions: type.auto_detect_instructions,
      csvDelimiter: type.csv_delimiter,
      csvIncludeHeaders: type.csv_include_headers,
      csvRowDetectionInstructions: type.csv_row_detection_instructions,
      csvMultiPageProcessing: type.csv_multi_page_processing,
      defaultUploadMode: type.default_upload_mode as 'manual' | 'auto' | undefined,
      lockUploadMode: type.lock_upload_mode || false,
      arraySplitConfigs: (arraySplitsByType.get(type.id) || []).map(split => ({
        id: split.id,
        extractionTypeId: split.extraction_type_id,
        targetArrayField: split.target_array_field,
        splitBasedOnField: split.split_based_on_field,
        splitStrategy: split.split_strategy as 'one_per_entry' | 'divide_evenly',
        createdAt: split.created_at,
        updatedAt: split.updated_at
      }))
    }));
  } catch (error) {
    console.error('Error fetching extraction types:', error);
    throw error;
  }
}

export async function updateExtractionTypes(types: ExtractionType[]): Promise<void> {
  console.log('=== updateExtractionTypes SERVICE START ===');
  console.log('Received types count:', types.length);
  console.log('Service input validation:');
  types.forEach((type, index) => {
    console.log(`  Service Type ${index}:`, {
      id: type.id,
      name: type.name,
      isTemp: type.id.startsWith('temp-'),
      hasName: !!type.name,
      hasInstructions: type.defaultInstructions !== undefined,
      hasTemplate: type.formatTemplate !== undefined,
      allRequiredFields: !!(type.name && type.defaultInstructions !== undefined && type.formatTemplate !== undefined)
    });
  });

  try {
    // Get existing types to determine which to update vs insert
    console.log('Fetching existing types from database...');
    const { data: existingTypes } = await supabase
      .from('extraction_types')
      .select('id');

    console.log('Existing types in database:', existingTypes?.length || 0);
    if (existingTypes) {
      console.log('Existing type IDs:', existingTypes.map(t => t.id));
    }
    
    const existingIds = new Set((existingTypes || []).map(t => t.id));
    const typesToUpdate = types.filter(type => existingIds.has(type.id) && !type.id.startsWith('temp-'));
    const typesToInsert = types.filter(type => !existingIds.has(type.id) || type.id.startsWith('temp-'));

    console.log('Operation breakdown:');
    console.log('  Types to update:', typesToUpdate.length);
    console.log('  Types to insert:', typesToInsert.length);
    
    if (typesToUpdate.length > 0) {
      console.log('  Update candidates:', typesToUpdate.map(t => ({ id: t.id, name: t.name })));
    }
    if (typesToInsert.length > 0) {
      console.log('  Insert candidates:', typesToInsert.map(t => ({ id: t.id, name: t.name, isTemp: t.id.startsWith('temp-') })));
    }
    
    // Update existing types
    for (const type of typesToUpdate) {
      console.log('Updating existing type:', type.name);
      const { error } = await supabase
        .from('extraction_types')
        .update({
          name: type.name,
          default_instructions: type.defaultInstructions,
          xml_format: type.formatTemplate,
          filename: type.filename,
          format_type: type.formatType,
          json_path: type.jsonPath,
          field_mappings: type.fieldMappings ? JSON.stringify(type.fieldMappings) : null,
          parseit_id_mapping: type.parseitIdMapping,
          trace_type_mapping: type.traceTypeMapping,
          trace_type_value: type.traceTypeValue,
          workflow_id: type.workflowId || null,
          auto_detect_instructions: type.autoDetectInstructions,
          csv_delimiter: type.csvDelimiter || ',',
          csv_include_headers: type.csvIncludeHeaders !== false,
          csv_row_detection_instructions: type.csvRowDetectionInstructions || null,
          csv_multi_page_processing: type.csvMultiPageProcessing || false,
          default_upload_mode: type.defaultUploadMode || null,
          lock_upload_mode: type.lockUploadMode || false,
          updated_at: new Date().toISOString()
        })
        .eq('id', type.id);

      if (error) throw error;
      console.log('Successfully updated type:', type.name);
    }

    // Insert new types
    if (typesToInsert.length > 0) {
      console.log('=== PREPARING INSERT OPERATION ===');
      console.log('Inserting new types:', typesToInsert.map(t => t.name));
      
      const insertData = typesToInsert.map(type => {
        console.log(`Preparing insert data for type: ${type.name}`);
        console.log('  Original type data:', {
          id: type.id,
          name: type.name,
          defaultInstructions: type.defaultInstructions,
          formatTemplate: type.formatTemplate,
          filename: type.filename,
          formatType: type.formatType,
          jsonPath: type.jsonPath,
          fieldMappings: type.fieldMappings,
          parseitIdMapping: type.parseitIdMapping,
          traceTypeMapping: type.traceTypeMapping,
          traceTypeValue: type.traceTypeValue,
          workflowId: type.workflowId,
          autoDetectInstructions: type.autoDetectInstructions
        });
        
        const mappedData = {
          name: type.name,
          default_instructions: type.defaultInstructions || '',
          xml_format: type.formatTemplate || '',
          filename: type.filename || '',
          format_type: type.formatType || 'XML',
          json_path: type.jsonPath || '',
          field_mappings: type.fieldMappings ? JSON.stringify(type.fieldMappings) : null,
          parseit_id_mapping: type.parseitIdMapping || null,
          trace_type_mapping: type.traceTypeMapping || null,
          trace_type_value: type.traceTypeValue || null,
          workflow_id: type.workflowId || null,
          auto_detect_instructions: type.autoDetectInstructions || null,
          csv_delimiter: type.csvDelimiter || ',',
          csv_include_headers: type.csvIncludeHeaders !== false,
          csv_row_detection_instructions: type.csvRowDetectionInstructions || null,
          csv_multi_page_processing: type.csvMultiPageProcessing || false,
          default_upload_mode: type.defaultUploadMode || null,
          lock_upload_mode: type.lockUploadMode || false
        };

        console.log('  Mapped data for database:', mappedData);
        console.log('  Required fields check:', {
          hasName: !!mappedData.name,
          hasInstructions: mappedData.default_instructions !== undefined,
          hasTemplate: mappedData.xml_format !== undefined
        });
        
        return mappedData;
      });
      
      console.log('=== EXECUTING DATABASE INSERT ===');
      console.log('Insert data array length:', insertData.length);
      console.log('Insert data being sent to Supabase:', JSON.stringify(insertData, null, 2));
      
      const { error } = await supabase
        .from('extraction_types')
        .insert(insertData);

      console.log('=== DATABASE INSERT RESPONSE ===');
      if (error) throw error;
      console.log('✅ DATABASE INSERT SUCCESSFUL');
      console.log('Successfully inserted', typesToInsert.length, 'new types');
    } else {
      console.log('No types to insert, skipping insert operation');
    }

    // FIXED: Don't do automatic cleanup for extraction types
    // The cleanup was deleting newly inserted records by mistake
    // Let the user manually delete types they don't want
    console.log('=== CLEANUP PHASE SKIPPED ===');
    console.log('Skipping automatic cleanup to prevent deleting newly inserted records');

    // Update array split configurations
    console.log('=== UPDATING ARRAY SPLIT CONFIGS ===');
    for (const type of types) {
      if (!type.id.startsWith('temp-') && type.arraySplitConfigs) {
        console.log(`Processing array split configs for ${type.name}`);

        const { data: existingArraySplits } = await supabase
          .from('extraction_type_array_splits')
          .select('id')
          .eq('extraction_type_id', type.id);

        const existingArraySplitIds = new Set((existingArraySplits || []).map(split => split.id));
        const splitsToUpdate = type.arraySplitConfigs.filter(split => existingArraySplitIds.has(split.id!) && !split.id!.startsWith('temp-'));
        const splitsToInsert = type.arraySplitConfigs.filter(split => !split.id || !existingArraySplitIds.has(split.id) || split.id.startsWith('temp-'));
        const splitIdsToKeep = new Set(type.arraySplitConfigs.filter(s => s.id).map(split => split.id!));
        const splitsToDelete = (existingArraySplits || []).filter(split => !splitIdsToKeep.has(split.id));

        for (const split of splitsToUpdate) {
          console.log(`Updating array split config: ${split.id}`);
          const { error } = await supabase
            .from('extraction_type_array_splits')
            .update({
              target_array_field: split.targetArrayField,
              split_based_on_field: split.splitBasedOnField,
              split_strategy: split.splitStrategy,
              updated_at: new Date().toISOString()
            })
            .eq('id', split.id!);

          if (error) {
            console.error('❌ Failed to update array split config:', error);
            console.error('Error details:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            });
            throw new Error(`Failed to update array split configuration: ${error.message}`);
          }
        }

        if (splitsToInsert.length > 0) {
          console.log(`Inserting ${splitsToInsert.length} array split configs for ${type.name}`);
          const insertData = splitsToInsert.map(split => ({
            extraction_type_id: type.id,
            target_array_field: split.targetArrayField,
            split_based_on_field: split.splitBasedOnField,
            split_strategy: split.splitStrategy
          }));

          console.log('Array split insert data:', insertData);

          const { error } = await supabase
            .from('extraction_type_array_splits')
            .insert(insertData);

          if (error) {
            console.error('❌ Failed to insert array split configs:', error);
            console.error('Error details:', {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            });
            throw new Error(`Failed to save array split configuration: ${error.message}`);
          }

          console.log(`✅ Successfully inserted ${splitsToInsert.length} array split configs`);
        }

        for (const split of splitsToDelete) {
          const { error } = await supabase
            .from('extraction_type_array_splits')
            .delete()
            .eq('id', split.id);

          if (error) throw error;
        }

        console.log(`Updated ${splitsToUpdate.length}, inserted ${splitsToInsert.length}, deleted ${splitsToDelete.length} array split configs for ${type.name}`);
      }
    }
    console.log('=== ARRAY SPLIT CONFIGS UPDATE COMPLETE ===');

    console.log('=== updateExtractionTypes SERVICE COMPLETE ===');
  } catch (error) {
    console.error('Error updating extraction types:', error);
    throw error;
  }
}

export async function deleteExtractionType(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('extraction_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting extraction type:', error);
    throw error;
  }
}

// Transformation Types
export async function fetchTransformationTypes(): Promise<TransformationType[]> {
  try {
    const { data, error } = await supabase
      .from('transformation_types')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const types = data || [];

    const { data: pageGroupData, error: pageGroupError } = await supabase
      .from('page_group_configs')
      .select('*')
      .order('group_order', { ascending: true });

    if (pageGroupError) {
      console.error('Error fetching page group configs:', pageGroupError);
    }

    const pageGroupsByType = new Map<string, any[]>();
    (pageGroupData || []).forEach(pg => {
      if (!pageGroupsByType.has(pg.transformation_type_id)) {
        pageGroupsByType.set(pg.transformation_type_id, []);
      }
      pageGroupsByType.get(pg.transformation_type_id)!.push(pg);
    });

    return types.map(type => ({
      id: type.id,
      name: type.name,
      defaultInstructions: type.default_instructions,
      filenameTemplate: type.filename_template,
      fieldMappings: type.field_mappings ? JSON.parse(type.field_mappings) : [],
      autoDetectInstructions: type.auto_detect_instructions,
      workflowId: type.workflow_id,
      userId: type.user_id,
      createdAt: type.created_at,
      updatedAt: type.updated_at,
      pagesPerGroup: type.pages_per_group || 1,
      documentStartPattern: type.document_start_pattern,
      documentStartDetectionEnabled: type.document_start_detection_enabled || false,
      defaultUploadMode: type.default_upload_mode as 'manual' | 'auto' | undefined,
      lockUploadMode: type.lock_upload_mode || false,
      pageGroupConfigs: (pageGroupsByType.get(type.id) || []).map(pg => ({
        id: pg.id,
        transformationTypeId: pg.transformation_type_id,
        groupOrder: pg.group_order,
        pagesPerGroup: pg.pages_per_group,
        workflowId: pg.workflow_id,
        smartDetectionPattern: pg.smart_detection_pattern,
        processMode: pg.process_mode as 'single' | 'all',
        filenameTemplate: pg.filename_template,
        fieldMappings: pg.field_mappings ? JSON.parse(pg.field_mappings) : undefined,
        useAiDetection: pg.use_ai_detection || false,
        fallbackBehavior: pg.fallback_behavior as 'skip' | 'fixed_position' | 'error' | undefined,
        detectionConfidenceThreshold: pg.detection_confidence_threshold || 0.7,
        createdAt: pg.created_at,
        updatedAt: pg.updated_at
      }))
    }));
  } catch (error) {
    console.error('Error fetching transformation types:', error);
    throw error;
  }
}

export async function updateTransformationTypes(types: TransformationType[]): Promise<void> {
  try {
    console.log('=== updateTransformationTypes SERVICE START ===');
    console.log('Received types count:', types.length);
    console.log('Service input validation:');
    types.forEach((type, index) => {
      console.log(`  Service Type ${index}:`, {
        id: type.id,
        name: type.name,
        isTemp: type.id.startsWith('temp-'),
        hasName: !!type.name,
        hasInstructions: type.defaultInstructions !== undefined,
        hasTemplate: type.filenameTemplate !== undefined,
        pagesPerGroup: type.pagesPerGroup,
        documentStartPattern: type.documentStartPattern,
        documentStartDetectionEnabled: type.documentStartDetectionEnabled,
        allRequiredFields: !!(type.name && type.defaultInstructions !== undefined && type.filenameTemplate !== undefined)
      });
    });
   
    // Get existing types to determine which to update vs insert
    console.log('Fetching existing types from database...');
    const { data: existingTypes } = await supabase
      .from('transformation_types')
      .select('id');

    console.log('Existing types in database:', existingTypes?.length || 0);
    if (existingTypes) {
      console.log('Existing type IDs:', existingTypes.map(t => t.id));
    }
    
    const existingIds = new Set((existingTypes || []).map(t => t.id));
    const typesToUpdate = types.filter(type => existingIds.has(type.id) && !type.id.startsWith('temp-'));
    const typesToInsert = types.filter(type => !existingIds.has(type.id) || type.id.startsWith('temp-'));

    console.log('Operation breakdown:');
    console.log('  Types to update:', typesToUpdate.length);
    console.log('  Types to insert:', typesToInsert.length);
    
    if (typesToUpdate.length > 0) {
      console.log('  Update candidates:', typesToUpdate.map(t => ({ id: t.id, name: t.name })));
    }
    if (typesToInsert.length > 0) {
      console.log('  Insert candidates:', typesToInsert.map(t => ({ id: t.id, name: t.name, isTemp: t.id.startsWith('temp-') })));
    }
   
    // Update existing types
    for (const type of typesToUpdate) {
     console.log('Updating existing type:', type.name);
      const { error } = await supabase
        .from('transformation_types')
        .update({
          name: type.name,
          default_instructions: type.defaultInstructions,
          filename_template: type.filenameTemplate,
          field_mappings: type.fieldMappings ? JSON.stringify(type.fieldMappings) : null,
          auto_detect_instructions: type.autoDetectInstructions,
          workflow_id: type.workflowId,
          user_id: type.userId,
          pages_per_group: type.pagesPerGroup || 1,
          document_start_pattern: type.documentStartPattern,
          document_start_detection_enabled: type.documentStartDetectionEnabled || false,
          default_upload_mode: type.defaultUploadMode || null,
          lock_upload_mode: type.lockUploadMode || false,
          updated_at: new Date().toISOString()
        })
        .eq('id', type.id);

      if (error) throw error;
     console.log('Successfully updated type:', type.name);
    }

    // Insert new types
    if (typesToInsert.length > 0) {
      console.log('=== PREPARING INSERT OPERATION ===');
      console.log('Inserting new types:', typesToInsert.map(t => t.name));
      
      const insertData = typesToInsert.map(type => {
        console.log(`Preparing insert data for type: ${type.name}`);
        console.log('  Original type data:', {
          id: type.id,
          name: type.name,
          defaultInstructions: type.defaultInstructions,
          filenameTemplate: type.filenameTemplate,
          fieldMappings: type.fieldMappings,
          autoDetectInstructions: type.autoDetectInstructions,
          workflowId: type.workflowId,
          userId: type.userId,
          pagesPerGroup: type.pagesPerGroup,
          documentStartPattern: type.documentStartPattern,
          documentStartDetectionEnabled: type.documentStartDetectionEnabled,
          defaultUploadMode: type.defaultUploadMode
        });

        const mappedData = {
          name: type.name,
          default_instructions: type.defaultInstructions || '',
          filename_template: type.filenameTemplate || '',
          field_mappings: type.fieldMappings ? JSON.stringify(type.fieldMappings) : null,
          auto_detect_instructions: type.autoDetectInstructions || '',
          workflow_id: type.workflowId || null,
          user_id: type.userId || null,
          pages_per_group: type.pagesPerGroup || 1,
          document_start_pattern: type.documentStartPattern || null,
          document_start_detection_enabled: type.documentStartDetectionEnabled || false,
          default_upload_mode: type.defaultUploadMode || null,
          lock_upload_mode: type.lockUploadMode || false
        };
        
        console.log('  Mapped data for database:', mappedData);
        console.log('  Required fields check:', {
          hasName: !!mappedData.name,
          hasInstructions: mappedData.default_instructions !== undefined,
          hasTemplate: mappedData.filename_template !== undefined
        });
        
        return mappedData;
      });
      
      console.log('=== EXECUTING DATABASE INSERT ===');
      console.log('Insert data array length:', insertData.length);
      console.log('Insert data being sent to Supabase:', JSON.stringify(insertData, null, 2));
     
      const { error } = await supabase
        .from('transformation_types')
        .insert(insertData);

      console.log('=== DATABASE INSERT RESPONSE ===');
      if (error) {
        console.error('❌ DATABASE INSERT FAILED');
        console.error('Error object:', error);
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          statusCode: (error as any).statusCode
        });
        console.error('Failed insert data was:', JSON.stringify(insertData, null, 2));
        throw error;
      } else {
        console.log('✅ DATABASE INSERT SUCCESSFUL');
        console.log('Successfully inserted', typesToInsert.length, 'new types');
      }
    } else {
      console.log('No types to insert, skipping insert operation');
    }

    // FIXED: Don't do automatic cleanup for transformation types
    // The cleanup was deleting newly inserted records by mistake
    // Let the user manually delete types they don't want
    console.log('=== CLEANUP PHASE SKIPPED ===');
    console.log('Skipping automatic cleanup to prevent deleting newly inserted records');

    console.log('=== UPDATING PAGE GROUP CONFIGS ===');
    for (const type of types) {
      if (!type.id.startsWith('temp-') && type.pageGroupConfigs) {
        console.log(`Processing page group configs for ${type.name}`);

        const { data: existingPageGroups } = await supabase
          .from('page_group_configs')
          .select('id')
          .eq('transformation_type_id', type.id);

        const existingPageGroupIds = new Set((existingPageGroups || []).map(pg => pg.id));
        const configsToUpdate = type.pageGroupConfigs.filter(cfg => existingPageGroupIds.has(cfg.id) && !cfg.id.startsWith('temp-'));
        const configsToInsert = type.pageGroupConfigs.filter(cfg => !existingPageGroupIds.has(cfg.id) || cfg.id.startsWith('temp-'));
        const configIdsToKeep = new Set(type.pageGroupConfigs.map(cfg => cfg.id));
        const configsToDelete = (existingPageGroups || []).filter(pg => !configIdsToKeep.has(pg.id));

        for (const config of configsToUpdate) {
          const { error } = await supabase
            .from('page_group_configs')
            .update({
              group_order: config.groupOrder,
              pages_per_group: config.pagesPerGroup,
              workflow_id: config.workflowId || null,
              smart_detection_pattern: config.smartDetectionPattern || null,
              process_mode: config.processMode,
              filename_template: config.filenameTemplate || null,
              field_mappings: config.fieldMappings ? JSON.stringify(config.fieldMappings) : null,
              use_ai_detection: config.useAiDetection || false,
              fallback_behavior: config.fallbackBehavior || 'skip',
              detection_confidence_threshold: config.detectionConfidenceThreshold || 0.7,
              updated_at: new Date().toISOString()
            })
            .eq('id', config.id);

          if (error) throw error;
        }

        if (configsToInsert.length > 0) {
          const insertData = configsToInsert.map(config => ({
            transformation_type_id: type.id,
            group_order: config.groupOrder,
            pages_per_group: config.pagesPerGroup,
            workflow_id: config.workflowId || null,
            smart_detection_pattern: config.smartDetectionPattern || null,
            process_mode: config.processMode,
            filename_template: config.filenameTemplate || null,
            field_mappings: config.fieldMappings ? JSON.stringify(config.fieldMappings) : null,
            use_ai_detection: config.useAiDetection || false,
            fallback_behavior: config.fallbackBehavior || 'skip',
            detection_confidence_threshold: config.detectionConfidenceThreshold || 0.7
          }));

          const { error } = await supabase
            .from('page_group_configs')
            .insert(insertData);

          if (error) throw error;
        }

        for (const config of configsToDelete) {
          const { error } = await supabase
            .from('page_group_configs')
            .delete()
            .eq('id', config.id);

          if (error) throw error;
        }

        console.log(`Updated ${configsToUpdate.length}, inserted ${configsToInsert.length}, deleted ${configsToDelete.length} page group configs for ${type.name}`);
      }
    }
    console.log('=== PAGE GROUP CONFIGS UPDATE COMPLETE ===');

    console.log('=== updateTransformationTypes SERVICE COMPLETE ===');
  } catch (error) {
    console.error('Error updating transformation types:', error);
    throw error;
  }
}

export async function deleteTransformationType(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('transformation_types')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting transformation type:', error);
    throw error;
  }
}