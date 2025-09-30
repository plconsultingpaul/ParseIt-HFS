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

    return (data || []).map(type => ({
      id: type.id,
      name: type.name,
      defaultInstructions: type.default_instructions,
      formatTemplate: type.xml_format,
      filename: type.filename,
      formatType: type.format_type as 'XML' | 'JSON',
      jsonPath: type.json_path,
      fieldMappings: type.field_mappings ? JSON.parse(type.field_mappings) : [],
      parseitIdMapping: type.parseit_id_mapping,
      traceTypeMapping: type.trace_type_mapping,
      traceTypeValue: type.trace_type_value,
      workflowId: type.workflow_id,
      autoDetectInstructions: type.auto_detect_instructions
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
          auto_detect_instructions: type.autoDetectInstructions || null
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

    return (data || []).map(type => ({
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
      documentStartDetectionEnabled: type.document_start_detection_enabled || false
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
          documentStartDetectionEnabled: type.documentStartDetectionEnabled
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
          document_start_detection_enabled: type.documentStartDetectionEnabled || false
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