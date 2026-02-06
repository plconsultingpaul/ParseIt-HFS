import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
import { FieldMapping, ArraySplitConfig, ArrayEntryConfig, ExtractionType } from '../../index.ts';
import { buildExtractionPrompt } from '../prompt-builder.ts';
import {
  applyFieldMappingPostProcessing,
  constructArraysFromEntryConfigs,
  parseExtractionResponse
} from '../data-processor.ts';
import { applyValidationFixes } from '../utils.ts';

export interface ExtractionResult {
  extractedContent: string;
  workflowOnlyData: string;
  isValid: boolean;
  error?: string;
}

export class GeminiService {
  private apiKey: string;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.5-pro') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async extractDataFromPdf(
    pdfBase64: string,
    extractionType: ExtractionType,
    fieldMappings: FieldMapping[],
    arraySplitConfigs: ArraySplitConfig[],
    arrayEntryConfigs: ArrayEntryConfig[]
  ): Promise<ExtractionResult> {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ model: this.modelName });

    const isJsonFormat = extractionType.format_type === 'JSON';
    const hasArrayEntryExtractions = arrayEntryConfigs.some(e => e.isEnabled && e.fields.some(f =>
      (f.fieldType === 'extracted' || f.fieldType === 'mapped') && f.extractionInstruction
    ));
    const hasWFOFields = isJsonFormat && (fieldMappings.some(m => m.isWorkflowOnly) || hasArrayEntryExtractions);

    console.log('Building prompt with field mappings:', {
      fieldMappingsCount: fieldMappings.length,
      arraySplitConfigsCount: arraySplitConfigs.length,
      hasParseitIdMapping: !!extractionType.parseit_id_mapping,
      hasTraceTypeMapping: !!extractionType.trace_type_mapping,
      hasWFOFields
    });

    const prompt = buildExtractionPrompt({
      extractionType,
      fieldMappings,
      arraySplitConfigs,
      arrayEntryConfigs,
      hasWFOFields
    });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64
        }
      },
      prompt
    ]);

    let extractedContent = result.response.text();
    let workflowOnlyData = '{}';

    console.log('Raw extracted data before validation:', extractedContent.substring(0, 500) + '...');

    const parsed = parseExtractionResponse(extractedContent, isJsonFormat, hasWFOFields);
    extractedContent = parsed.extractedContent;
    workflowOnlyData = parsed.workflowOnlyData;

    if (isJsonFormat) {
      try {
        console.log('Applying validation fixes to JSON data...');
        extractedContent = applyValidationFixes(extractedContent);
        console.log('Validation fixes applied. Final data preview:', extractedContent.substring(0, 500) + '...');
      } catch (parseError) {
        console.warn('Could not parse JSON for validation fixes:', parseError);
      }

      try {
        let jsonData = JSON.parse(extractedContent);
        console.log('Applying field mapping post-processing...');
        jsonData = applyFieldMappingPostProcessing(jsonData, fieldMappings);

        if (arrayEntryConfigs.length > 0) {
          console.log('Constructing arrays from entry configs...');
          let wfoData: Record<string, any> = {};
          try {
            wfoData = JSON.parse(workflowOnlyData);
          } catch {
            console.warn('Failed to parse workflowOnlyData for array entries');
          }
          constructArraysFromEntryConfigs(jsonData, arrayEntryConfigs, wfoData);
          workflowOnlyData = JSON.stringify(wfoData);
          console.log('Array entry construction complete');
        }

        extractedContent = JSON.stringify(jsonData, null, 2);
        console.log('Field mapping post-processing complete');
      } catch (e) {
        return {
          extractedContent: '',
          workflowOnlyData: '{}',
          isValid: false,
          error: 'AI returned invalid JSON format'
        };
      }
    } else {
      if (!extractedContent.startsWith('<') || !extractedContent.endsWith('>')) {
        return {
          extractedContent: '',
          workflowOnlyData: '{}',
          isValid: false,
          error: 'AI returned invalid XML format'
        };
      }
    }

    return {
      extractedContent,
      workflowOnlyData,
      isValid: true
    };
  }
}

export function parseFieldMappings(extractionType: ExtractionType): FieldMapping[] {
  if (!extractionType.field_mappings) {
    return [];
  }

  if (typeof extractionType.field_mappings === 'string') {
    return JSON.parse(extractionType.field_mappings);
  }

  return extractionType.field_mappings;
}

export function parseArraySplitConfigs(extractionType: ExtractionType): ArraySplitConfig[] {
  return (extractionType.extraction_type_array_splits || []).map((s: any) => ({
    targetArrayField: s.target_array_field,
    splitBasedOnField: s.split_based_on_field,
    splitStrategy: s.split_strategy,
    defaultToOneIfMissing: s.default_to_one_if_missing
  }));
}

export function parseArrayEntryConfigs(extractionType: ExtractionType): ArrayEntryConfig[] {
  const configs = (extractionType.extraction_type_array_entries || []).map((e: any) => {
    const fields = (e.extraction_type_array_entry_fields || []).map((f: any) => {
      const field = {
        fieldName: f.field_name,
        fieldType: f.field_type,
        hardcodedValue: f.hardcoded_value,
        extractionInstruction: f.extraction_instruction,
        dataType: f.data_type,
        removeIfNull: f.remove_if_null || false
      };
      console.log(`[ArrayEntryParser] Field parsed - name: "${field.fieldName}", fieldType: "${field.fieldType}", hardcodedValue: "${field.hardcodedValue}"`);
      return field;
    });

    const config = {
      targetArrayField: e.target_array_field,
      entryOrder: e.entry_order,
      isEnabled: e.is_enabled,
      isRepeating: e.is_repeating || false,
      repeatInstruction: e.repeat_instruction,
      aiConditionInstruction: e.ai_condition_instruction,
      fields
    };
    console.log(`[ArrayEntryParser] Entry parsed - array: "${config.targetArrayField}", isRepeating: ${config.isRepeating}, aiCondition: ${!!config.aiConditionInstruction}, fieldsCount: ${config.fields.length}`);
    return config;
  });

  console.log(`[ArrayEntryParser] Total entries parsed: ${configs.length}`);
  return configs;
}
