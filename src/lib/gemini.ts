import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFDocument } from 'pdf-lib';
import { withRetry } from './retryHelper';
import { geminiConfigService } from '../services/geminiConfigService';
import { evaluateFunction, evaluateAddressLookup } from './functionEvaluator';
import type { FieldMappingFunction, AddressLookupFunctionLogic } from '../types';

async function getActiveModelName(): Promise<string> {
  try {
    const config = await geminiConfigService.getActiveConfiguration();
    if (config && config.modelName) {
      return config.modelName;
    }
  } catch (error) {
    console.warn('Failed to fetch active Gemini model, using default:', error);
  }
  return 'gemini-2.5-pro';
}

// Helper function to truncate a string based on its JSON-escaped length
function truncateJsonEscaped(str: string, maxLength: number): string {
  if (!str || maxLength <= 0) {
    return '';
  }
  
  // Helper to calculate JSON-escaped length (excluding surrounding quotes)
  const getJsonEscapedLength = (s: string): number => {
    return JSON.stringify(s).length - 2;
  };
  
  // If the string is already within the limit, return as-is
  if (getJsonEscapedLength(str) <= maxLength) {
    return str;
  }
  
  // Use binary search to find the longest prefix that fits within maxLength
  let left = 0;
  let right = str.length;
  let result = '';
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const prefix = str.substring(0, mid);
    const escapedLength = getJsonEscapedLength(prefix);
    
    if (escapedLength <= maxLength) {
      result = prefix;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  
  return result;
}

// Helper function to format phone numbers
function formatPhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Only format if we have exactly 10 digits or 11 digits starting with '1'
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // Remove leading '1' and format the remaining 10 digits
    const tenDigits = digits.slice(1);
    return `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`;
  }
  
  // Return empty string for invalid phone numbers to prevent API validation errors
  return "";
}

// Helper function to normalize boolean values
function normalizeBooleanValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'False';
  }

  const strValue = String(value).trim().toLowerCase();

  if (strValue === 'true' || strValue === 'yes' || strValue === '1') {
    return 'True';
  }

  if (strValue === 'false' || strValue === 'no' || strValue === '0') {
    return 'False';
  }

  return 'False';
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function evaluateArrayEntryConditions(
  conditions: ArrayEntryConditions | undefined,
  orderData: Record<string, any>,
  wfoData: Record<string, any>
): boolean {
  if (!conditions || !conditions.enabled || conditions.rules.length === 0) {
    return true;
  }

  const results = conditions.rules.map(rule => {
    let value = getNestedValue(orderData, rule.fieldPath);
    if (value === undefined) {
      value = getNestedValue(wfoData, rule.fieldPath);
    }

    const strValue = value !== undefined && value !== null ? String(value) : '';
    const compareValue = rule.value || '';

    switch (rule.operator) {
      case 'equals':
        return strValue.toLowerCase() === compareValue.toLowerCase();
      case 'notEquals':
        return strValue.toLowerCase() !== compareValue.toLowerCase();
      case 'contains':
        return strValue.toLowerCase().includes(compareValue.toLowerCase());
      case 'notContains':
        return !strValue.toLowerCase().includes(compareValue.toLowerCase());
      case 'greaterThan': {
        const numValue = parseFloat(strValue);
        const numCompare = parseFloat(compareValue);
        return !isNaN(numValue) && !isNaN(numCompare) && numValue > numCompare;
      }
      case 'lessThan': {
        const numValue = parseFloat(strValue);
        const numCompare = parseFloat(compareValue);
        return !isNaN(numValue) && !isNaN(numCompare) && numValue < numCompare;
      }
      case 'greaterThanOrEqual': {
        const numValue = parseFloat(strValue);
        const numCompare = parseFloat(compareValue);
        return !isNaN(numValue) && !isNaN(numCompare) && numValue >= numCompare;
      }
      case 'lessThanOrEqual': {
        const numValue = parseFloat(strValue);
        const numCompare = parseFloat(compareValue);
        return !isNaN(numValue) && !isNaN(numCompare) && numValue <= numCompare;
      }
      case 'isEmpty':
        return strValue === '' || strValue === 'null' || strValue === 'undefined';
      case 'isNotEmpty':
        return strValue !== '' && strValue !== 'null' && strValue !== 'undefined';
      default:
        return true;
    }
  });

  return conditions.logic === 'AND'
    ? results.every(r => r)
    : results.some(r => r);
}

export interface ArraySplitConfig {
  id?: string;
  targetArrayField: string;
  splitBasedOnField: string;
  splitStrategy: 'one_per_entry' | 'divide_evenly';
  defaultToOneIfMissing?: boolean;
}

export interface ArrayEntryField {
  fieldName: string;
  fieldType: 'hardcoded' | 'extracted' | 'mapped';
  hardcodedValue?: string;
  extractionInstruction?: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime' | 'boolean';
}

export interface ArrayEntryConditionRule {
  fieldPath: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'isEmpty' | 'isNotEmpty';
  value: string;
}

export interface ArrayEntryConditions {
  enabled: boolean;
  logic: 'AND' | 'OR';
  rules: ArrayEntryConditionRule[];
}

export interface ArrayEntryConfig {
  id?: string;
  targetArrayField: string;
  entryOrder: number;
  isEnabled: boolean;
  fields: ArrayEntryField[];
  conditions?: ArrayEntryConditions;
  isRepeating?: boolean;
  repeatInstruction?: string;
}

export interface ExtractionRequest {
  pdfFile: File;
  defaultInstructions: string;
  additionalInstructions?: string;
  formatTemplate: string;
  formatType?: string;
  fieldMappings?: any[];
  parseitIdMapping?: string;
  traceTypeMapping?: string;
  traceTypeValue?: string;
  apiKey: string;
  arraySplitConfigs?: ArraySplitConfig[];
  arrayEntryConfigs?: ArrayEntryConfig[];
  functions?: FieldMappingFunction[];
}

export interface JsonMultiPageExtractionRequest {
  pdfFiles: File[];
  defaultInstructions: string;
  additionalInstructions?: string;
  formatTemplate: string;
  fieldMappings?: any[];
  parseitIdMapping?: string;
  traceTypeMapping?: string;
  traceTypeValue?: string;
  apiKey: string;
  arraySplitConfigs?: ArraySplitConfig[];
  functions?: FieldMappingFunction[];
}

export interface ExtractionResult {
  templateData: string;
  workflowOnlyData: string;
}

export async function extractDataFromPDF({
  pdfFile,
  defaultInstructions,
  additionalInstructions,
  formatTemplate,
  formatType = 'XML',
  fieldMappings = [],
  parseitIdMapping,
  traceTypeMapping,
  traceTypeValue,
  apiKey,
  arraySplitConfigs = [],
  arrayEntryConfigs = [],
  functions = []
}: ExtractionRequest): Promise<ExtractionResult> {
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured. Please add it in the API settings.');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const activeModelName = await getActiveModelName();
    const model = genAI.getGenerativeModel({ model: activeModelName });

    // Convert PDF to base64
    const pdfBase64 = await fileToBase64(pdfFile);

    // Combine instructions
    const fullInstructions = additionalInstructions 
      ? `${defaultInstructions}\n\nAdditional Instructions: ${additionalInstructions}`
      : defaultInstructions;

    const isJsonFormat = formatType === 'JSON';
    const outputFormat = isJsonFormat ? 'JSON' : 'XML';
    const templateLabel = isJsonFormat ? 'JSON structure' : 'XML template structure';

    // Separate regular fields from workflow-only fields
    const regularMappings = fieldMappings.filter(m => !m.isWorkflowOnly);
    const wfoMappings = fieldMappings.filter(m => m.isWorkflowOnly);

    console.log(`[extractDataFromPDF] Total field mappings: ${fieldMappings.length}`);
    console.log(`[extractDataFromPDF] Regular mappings: ${regularMappings.length}`);
    console.log(`[extractDataFromPDF] WFO mappings: ${wfoMappings.length}`);

    // Add postal code formatting rules
    const postalCodeRules = `

POSTAL CODE FORMATTING RULES:
- Canadian Postal Codes: Always format as "AAA AAA" (3 letters, space, 3 letters/numbers) - Example: "H1W 1S3" not "H1W1S3"
- US Zip Codes: Always format as "11111" (5 digits, no spaces or dashes) - Example: "90210" not "90210-1234"
- If you detect a Canadian postal code pattern (letter-number-letter number-letter-number), add the space: "H1W1S3" becomes "H1W 1S3"
- If you detect a US zip code pattern, use only the first 5 digits: "90210-1234" becomes "90210"

PROVINCE AND STATE FORMATTING RULES:
- Canadian Provinces: Always format as 2-letter code only - Example: "BC" not "British Columbia", "ON" not "Ontario"
- US States: Always format as 2-letter code only - Example: "WA" not "Washington", "CA" not "California"
- If you detect a full province or state name, convert it to the 2-letter code
- Valid Canadian province codes: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT
- Valid US state codes: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY`;

    // Build field mapping instructions for JSON (regular fields only)
    let fieldMappingInstructions = '';
    if (isJsonFormat && regularMappings.length > 0) {
      fieldMappingInstructions = '\n\nFIELD MAPPING INSTRUCTIONS:\n';
      regularMappings.forEach(mapping => {
        const getDateTimeNote = (m: any) => m.dateOnly
          ? ' (as date string in yyyy-MM-dd format)'
          : ' (as datetime string in yyyy-MM-ddThh:mm:ss format)';
        if (mapping.type === 'hardcoded') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (as formatted phone number XXX-XXX-XXXX)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": Always use the EXACT hardcoded value "${mapping.value}"${dataTypeNote}\n`;
        } else if (mapping.type === 'mapped') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`;
        } else {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}\n`;
        }
      });
    }

    // Add Parse-It ID mapping instructions for JSON
    let parseitIdInstructions = '';
    if (isJsonFormat && parseitIdMapping) {
      parseitIdInstructions = `\n\nPARSE-IT ID MAPPING:\n- "${parseitIdMapping}": This field will be automatically populated with a unique Parse-It ID number. For now, use the placeholder value "{{PARSE_IT_ID_PLACEHOLDER}}" (this will be replaced automatically).\n`;
    }

    // Add trace type mapping instructions for JSON
    let traceTypeInstructions = '';
    if (isJsonFormat && traceTypeMapping && traceTypeValue) {
      traceTypeInstructions = `\n\nTRACE TYPE MAPPING:\n- "${traceTypeMapping}": Always set this field to the exact value "${traceTypeValue}".\n`;
    }

    // Add Parse-It ID mapping instructions for XML
    let xmlParseitIdInstructions = '';
    if (!isJsonFormat && parseitIdMapping) {
      xmlParseitIdInstructions = `\n\nPARSE-IT ID MAPPING FOR XML:\n- At the XML path "${parseitIdMapping}": Insert the placeholder value "{{PARSE_IT_ID_PLACEHOLDER}}" (this will be replaced automatically with a unique Parse-It ID).\n`;
    }

    // Add trace type mapping instructions for XML
    let xmlTraceTypeInstructions = '';
    if (!isJsonFormat && traceTypeMapping && traceTypeValue) {
      xmlTraceTypeInstructions = `\n\nTRACE TYPE MAPPING FOR XML:\n- At the XML path "${traceTypeMapping}": Always set this attribute/element to the exact value "${traceTypeValue}".\n`;
    }

    // Add array split instructions for JSON
    let arraySplitInstructions = '';
    if (isJsonFormat && arraySplitConfigs && arraySplitConfigs.length > 0) {
      arraySplitInstructions = '\n\nARRAY SPLIT INSTRUCTIONS:\n';
      arraySplitConfigs.forEach(config => {
        if (config.splitStrategy === 'one_per_entry') {
          const fallbackInstruction = config.defaultToOneIfMissing
            ? ` If the "${config.splitBasedOnField}" field is not found, empty, or has a value of 0, create 1 entry in the "${config.targetArrayField}" array with "${config.splitBasedOnField}" set to 1.`
            : '';
          arraySplitInstructions += `- For the "${config.targetArrayField}" array: Look at the value of the "${config.splitBasedOnField}" field in the document. If this field has a value of N (for example, if "${config.splitBasedOnField}" = 3), create N separate entries in the "${config.targetArrayField}" array. Each entry should have "${config.splitBasedOnField}" set to 1, and all other fields should contain the same data from the document. For example, if pieces = 3, create 3 barcode entries each with pieces = 1.${fallbackInstruction}\n`;
        } else {
          const fallbackInstruction = config.defaultToOneIfMissing
            ? ` If the "${config.splitBasedOnField}" field is not found, empty, or has a value of 0, create 1 entry in the "${config.targetArrayField}" array.`
            : '';
          arraySplitInstructions += `- For the "${config.targetArrayField}" array: Look at the value of the "${config.splitBasedOnField}" field and create multiple entries distributing the value evenly across them based on the data in the document.${fallbackInstruction}\n`;
        }
      });
    }

    // Build array entry extraction instructions for JSON
    // This extracts values for array entry fields that need AI extraction
    let arrayEntryExtractionInstructions = '';
    const enabledArrayEntries = arrayEntryConfigs.filter(e => e.isEnabled);
    console.log(`[PROMPT DEBUG] Total array entry configs: ${arrayEntryConfigs.length}`);
    console.log(`[PROMPT DEBUG] Enabled array entries: ${enabledArrayEntries.length}`);
    enabledArrayEntries.forEach(entry => {
      console.log(`[PROMPT DEBUG]   Entry: ${entry.targetArrayField}[${entry.entryOrder}], isRepeating: ${entry.isRepeating}`);
      entry.fields.forEach(field => {
        console.log(`[PROMPT DEBUG]     Field: ${field.fieldName}, fieldType: "${field.fieldType}", hardcodedValue: "${field.hardcodedValue}", extractionInstruction: "${field.extractionInstruction}"`);
      });
    });

    if (isJsonFormat && enabledArrayEntries.length > 0) {
      // Separate repeating and non-repeating entries
      const repeatingEntries = enabledArrayEntries.filter(e => e.isRepeating);
      const staticEntries = enabledArrayEntries.filter(e => !e.isRepeating);

      console.log(`[PROMPT DEBUG] Repeating entries: ${repeatingEntries.length}`);
      console.log(`[PROMPT DEBUG] Static entries: ${staticEntries.length}`);

      // Handle static (non-repeating) entries - extract as standalone fields
      const staticExtractedFields = staticEntries.flatMap(entry =>
        entry.fields
          .filter(f => f.fieldType === 'extracted' && f.extractionInstruction)
          .map(f => ({
            key: `__ARRAY_ENTRY_${entry.targetArrayField}_${entry.entryOrder}_${f.fieldName}__`,
            instruction: f.extractionInstruction,
            dataType: f.dataType || 'string'
          }))
      );
      console.log(`[PROMPT DEBUG] Static extracted fields to send to AI: ${staticExtractedFields.length}`);
      staticExtractedFields.forEach(f => {
        console.log(`[PROMPT DEBUG]   Key: ${f.key}, Instruction: "${f.instruction}"`);
      });

      if (staticExtractedFields.length > 0) {
        arrayEntryExtractionInstructions = '\n\nARRAY ENTRY FIELD EXTRACTIONS:\n';
        arrayEntryExtractionInstructions += 'Extract these additional values as standalone fields in the workflow-only data section:\n';
        staticExtractedFields.forEach(({ key, instruction, dataType }) => {
          const dataTypeNote = dataType === 'string' ? ' (as UPPER CASE string)' :
                              dataType === 'number' ? ' (format as number)' :
                              dataType === 'integer' ? ' (format as integer)' :
                              dataType === 'datetime' ? ' (as datetime string in yyyy-MM-ddThh:mm:ss format)' : '';
          arrayEntryExtractionInstructions += `- "${key}": ${instruction}${dataTypeNote}\n`;
        });
        console.log('[PROMPT DEBUG] Built arrayEntryExtractionInstructions:', arrayEntryExtractionInstructions);
      }

      // Handle repeating entries - extract as arrays
      if (repeatingEntries.length > 0) {
        arrayEntryExtractionInstructions += '\n\nREPEATING ARRAY EXTRACTIONS:\n';
        arrayEntryExtractionInstructions += 'For each of the following, find ALL matching rows in the PDF and return an ARRAY of objects:\n\n';

        repeatingEntries.forEach(entry => {
          const arrayKey = `__REPEATING_ARRAY_${entry.targetArrayField}__`;
          arrayEntryExtractionInstructions += `- "${arrayKey}": ${entry.repeatInstruction || 'Find all matching rows'}\n`;
          arrayEntryExtractionInstructions += `  Return as an array of objects, where each object has these fields:\n`;

          entry.fields.forEach(field => {
            const dataTypeNote = field.dataType === 'string' ? ' (UPPER CASE string)' :
                                field.dataType === 'number' ? ' (number)' :
                                field.dataType === 'integer' ? ' (integer)' :
                                field.dataType === 'datetime' ? ' (datetime yyyy-MM-ddThh:mm:ss)' :
                                field.dataType === 'boolean' ? ' (boolean: use "True" or "False" as string)' : '';
            if (field.fieldType === 'hardcoded') {
              arrayEntryExtractionInstructions += `    - "${field.fieldName}": Always "${field.hardcodedValue}"${dataTypeNote}\n`;
            } else {
              arrayEntryExtractionInstructions += `    - "${field.fieldName}": ${field.extractionInstruction}${dataTypeNote}\n`;
            }
          });
          arrayEntryExtractionInstructions += '\n';
        });
      }
    }

    // Build workflow-only field instructions
    let wfoInstructions = '';
    if (wfoMappings.length > 0) {
      wfoInstructions = '\n\nWORKFLOW-ONLY FIELDS (SEPARATE EXTRACTION):\n';
      wfoInstructions += 'Extract these additional fields as standalone variables for workflow use (NOT part of the main template structure):\n';
      wfoMappings.forEach(mapping => {
        const getDateTimeNote = (m: any) => m.dateOnly
          ? ' (as date string in yyyy-MM-dd format)'
          : ' (as datetime string in yyyy-MM-ddThh:mm:ss format)';
        if (mapping.type === 'hardcoded') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (as formatted phone number XXX-XXX-XXXX)' : '';
          wfoInstructions += `- "${mapping.fieldName}": Always use the EXACT hardcoded value "${mapping.value}"${dataTypeNote}\n`;
        } else if (mapping.type === 'mapped') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' : '';
          wfoInstructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`;
        } else {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' : '';
          wfoInstructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}\n`;
        }
      });
    }

    const hasArrayEntryExtractions = arrayEntryExtractionInstructions.length > 0;
    const hasWFOFields = wfoMappings.length > 0 || hasArrayEntryExtractions;
    console.log('[PROMPT DEBUG] hasArrayEntryExtractions:', hasArrayEntryExtractions);
    console.log('[PROMPT DEBUG] hasWFOFields:', hasWFOFields);
    console.log('[PROMPT DEBUG] wfoMappings.length:', wfoMappings.length);
    console.log('[PROMPT DEBUG] arrayEntryExtractionInstructions.length:', arrayEntryExtractionInstructions.length);
    const prompt = `
You are a data extraction AI. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}${fieldMappingInstructions}${parseitIdInstructions}${traceTypeInstructions}${xmlParseitIdInstructions}${xmlTraceTypeInstructions}${arraySplitInstructions}${arrayEntryExtractionInstructions}${wfoInstructions}${postalCodeRules}

OUTPUT FORMAT:
${hasWFOFields ? 'You need to extract TWO separate data structures from the PDF:\n\n1. MAIN TEMPLATE DATA:\n' : ''}Please format the extracted data as ${outputFormat} following this EXACT ${templateLabel} structure:
${formatTemplate}${hasWFOFields ? '\n\n2. WORKFLOW-ONLY DATA:\nProvide the workflow-only fields as a separate JSON object with the field names as keys and their extracted values.\n\nIMPORTANT: Return BOTH structures in a wrapper object like this:\n{\n  "templateData": <your extracted template data here>,\n  "workflowOnlyData": {\n    <workflow field name>: <extracted value>,\n    ...\n  }\n}\n\nIf there are no workflow-only fields, set workflowOnlyData to an empty object {}.' : ''}

IMPORTANT GUIDELINES:
1. Only extract information that is clearly visible in the document
2. CRITICAL: Follow the EXACT structure provided in the template. Do not add extra fields at the root level or change the nesting structure
3. If a field is not found in JSON format, use empty string ("") for text fields, 0 for numbers, null for fields that should be null, or [] for arrays. For datetime fields that are empty, use today's date in yyyy-MM-ddThh:mm:ss format. For XML format, use "N/A" or leave it empty
4. Maintain the exact ${outputFormat} structure provided and preserve exact case for all hardcoded values
5. Do NOT duplicate fields outside of their proper nested structure
6. ${isJsonFormat ? 'Ensure valid JSON syntax with proper quotes and brackets' : 'Ensure all XML tags are properly closed'}
7. Use appropriate data types (dates, numbers, text). For JSON, ensure empty values are represented as empty strings (""), not "N/A". CRITICAL: For hardcoded values, use the EXACT case as specified (e.g., "True" not "true", "False" not "false"). For datetime fields, use the format yyyy-MM-ddThh:mm:ss (e.g., "2024-03-15T14:30:00"). If a datetime field is empty or not found, use today's date and current time in the same format. CRITICAL: For all string data type fields (dataType="string"), convert the extracted value to UPPER CASE before including it in the output
8. Be precise and accurate with the extracted data
9. ${isJsonFormat ? 'CRITICAL: For JSON output, the ONLY top-level key allowed is "orders". Do NOT include any other top-level keys or duplicate fields at the root level. Return ONLY the JSON structure from the template - no additional fields outside the "orders" array.' : 'CRITICAL FOR XML: Your response MUST start with the opening tag of the root element from the template and end with its closing tag. Do NOT include any XML content outside of this structure. Do NOT duplicate any elements or add extra XML blocks after the main structure. Return ONLY the complete XML structure from the template with no additional content before or after it.'}

Please provide only the ${outputFormat} output without any additional explanation or formatting.
`;

    // Log key sections of the prompt for debugging
    if (arrayEntryExtractionInstructions.length > 0) {
      console.log('[PROMPT DEBUG] ====== ARRAY ENTRY EXTRACTION SECTION IN PROMPT ======');
      console.log(arrayEntryExtractionInstructions);
      console.log('[PROMPT DEBUG] ====================================================');
    }

    const result = await withRetry(
      () => model.generateContent([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64
          }
        },
        prompt
      ]),
      'Gemini API extraction'
    );

    const response = await result.response;
    let extractedContent = response.text();

    // Declare variables at function scope for return
    let templateData: string;
    let workflowOnlyData: string = '{}';

    // Clean up the response - remove any markdown formatting
    if (isJsonFormat) {
      extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Handle dual-structure response when WFO fields exist
      if (hasWFOFields) {
        try {
          const wrapper = JSON.parse(extractedContent);
          if (wrapper.templateData && wrapper.workflowOnlyData !== undefined) {
            templateData = typeof wrapper.templateData === 'string'
              ? wrapper.templateData
              : JSON.stringify(wrapper.templateData);
            workflowOnlyData = typeof wrapper.workflowOnlyData === 'string'
              ? wrapper.workflowOnlyData
              : JSON.stringify(wrapper.workflowOnlyData);
            console.log('[extractDataFromPDF] Successfully parsed dual-structure response');
            console.log('[extractDataFromPDF] Template data length:', templateData.length);
            console.log('[extractDataFromPDF] WFO data (raw from AI):', workflowOnlyData);
            console.log('[extractDataFromPDF] WFO data keys:', Object.keys(wrapper.workflowOnlyData));
          } else {
            console.warn('[extractDataFromPDF] Wrapper missing expected fields, using full response as template');
            templateData = extractedContent;
            workflowOnlyData = '{}';
          }
        } catch (wrapperError) {
          console.warn('[extractDataFromPDF] Failed to parse wrapper, using full response as template:', wrapperError);
          templateData = extractedContent;
          workflowOnlyData = '{}';
        }
      } else {
        templateData = extractedContent;
      }

      // Post-process JSON to enforce structure and handle field mappings (for template data)
      try {
        let jsonData = JSON.parse(templateData);
        
        // STEP 1: Remove any unwanted top-level keys (only "orders" should exist at root)
        const allowedTopLevelKeys = ['orders'];
        const keysToRemove = Object.keys(jsonData).filter(key => !allowedTopLevelKeys.includes(key));
        keysToRemove.forEach(key => {
          delete jsonData[key];
        });
        
        // STEP 2: Ensure "orders" exists and is an array
        if (!jsonData.orders || !Array.isArray(jsonData.orders)) {
          jsonData.orders = [];
        }
        
        // STEP 3: Process field mappings and data types for each order (using regular mappings only)
        if (regularMappings.length > 0) {
          const currentDateTime = new Date().toISOString().slice(0, 19); // yyyy-MM-ddThh:mm:ss format

          const processObject = (obj: any, mappings: any[]) => {
            mappings.forEach(mapping => {
              if (mapping.dataType === 'datetime') {
                const fieldPath = mapping.fieldName.split('.');
                let current = obj;

                // Navigate to the field location, handling arrays
                for (let i = 0; i < fieldPath.length - 1; i++) {
                  if (current[fieldPath[i]] === undefined) {
                    current[fieldPath[i]] = {};
                  }

                  // If we encounter an array, process each item recursively
                  if (Array.isArray(current[fieldPath[i]])) {
                    const remainingPath = fieldPath.slice(i + 1).join('.');
                    const nestedMapping = { ...mapping, fieldName: remainingPath };
                    current[fieldPath[i]].forEach((item: any) => {
                      processObject(item, [nestedMapping]);
                    });
                    return;
                  }

                  current = current[fieldPath[i]];
                }

                const finalField = fieldPath[fieldPath.length - 1];

                // Set default datetime if field is empty or doesn't exist
                if (!current[finalField] || current[finalField] === "" || current[finalField] === "N/A") {
                  if (mapping.type === 'hardcoded' && mapping.value) {
                    current[finalField] = mapping.value;
                  } else {
                    current[finalField] = currentDateTime;
                  }
                }

                // For dateOnly fields, ensure time is set to 00:00:00
                if (mapping.dateOnly && current[finalField]) {
                  const dateValue = String(current[finalField]);
                  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                    current[finalField] = `${dateValue}T00:00:00`;
                  } else if (/^\d{4}-\d{2}-\d{2}T/.test(dateValue)) {
                    current[finalField] = `${dateValue.slice(0, 10)}T00:00:00`;
                  }
                }
              } else if (mapping.dataType === 'phone') {
                const fieldPath = mapping.fieldName.split('.');
                let current = obj;

                // Navigate to the field location, handling arrays
                for (let i = 0; i < fieldPath.length - 1; i++) {
                  if (current[fieldPath[i]] === undefined) {
                    current[fieldPath[i]] = {};
                  }

                  // If we encounter an array, process each item recursively
                  if (Array.isArray(current[fieldPath[i]])) {
                    const remainingPath = fieldPath.slice(i + 1).join('.');
                    const nestedMapping = { ...mapping, fieldName: remainingPath };
                    current[fieldPath[i]].forEach((item: any) => {
                      processObject(item, [nestedMapping]);
                    });
                    return;
                  }

                  current = current[fieldPath[i]];
                }

                const finalField = fieldPath[fieldPath.length - 1];

                // Format phone number if field has a value
                if (current[finalField] && typeof current[finalField] === 'string') {
                  const formattedPhone = formatPhoneNumber(current[finalField]);
                  current[finalField] = formattedPhone || "";
                }
              } else if (mapping.dataType === 'string' || !mapping.dataType) {
                const fieldPath = mapping.fieldName.split('.');
                let current = obj;

                // Navigate to the field location, handling arrays
                for (let i = 0; i < fieldPath.length - 1; i++) {
                  if (current[fieldPath[i]] === undefined) {
                    current[fieldPath[i]] = {};
                  }

                  // If we encounter an array, process each item recursively
                  if (Array.isArray(current[fieldPath[i]])) {
                    const remainingPath = fieldPath.slice(i + 1).join('.');
                    const nestedMapping = { ...mapping, fieldName: remainingPath };
                    current[fieldPath[i]].forEach((item: any) => {
                      processObject(item, [nestedMapping]);
                    });
                    return;
                  }

                  current = current[fieldPath[i]];
                }

                const finalField = fieldPath[fieldPath.length - 1];

                // Convert null string fields to empty strings, but preserve other falsy values like ""
                if (current[finalField] === null || current[finalField] === "null") {
                  current[finalField] = "";
                }

                // Convert string values to UPPER CASE
                if (typeof current[finalField] === 'string' && current[finalField] !== "") {
                  current[finalField] = current[finalField].toUpperCase();
                }

                // Apply max length truncation for string fields (after uppercase conversion)
                if (mapping.maxLength && typeof mapping.maxLength === 'number' && mapping.maxLength > 0) {
                  if (typeof current[finalField] === 'string') {
                    // Check if the JSON-escaped length exceeds the max length
                    const jsonEscapedLength = JSON.stringify(current[finalField]).length - 2;
                    if (jsonEscapedLength > mapping.maxLength) {
                      current[finalField] = truncateJsonEscaped(current[finalField], mapping.maxLength);
                    }
                  }
                }
              } else if (mapping.dataType === 'boolean') {
                const fieldPath = mapping.fieldName.split('.');
                let current = obj;

                // Navigate to the field location, handling arrays
                for (let i = 0; i < fieldPath.length - 1; i++) {
                  if (current[fieldPath[i]] === undefined) {
                    current[fieldPath[i]] = {};
                  }

                  // If we encounter an array, process each item recursively
                  if (Array.isArray(current[fieldPath[i]])) {
                    const remainingPath = fieldPath.slice(i + 1).join('.');
                    const nestedMapping = { ...mapping, fieldName: remainingPath };
                    current[fieldPath[i]].forEach((item: any) => {
                      processObject(item, [nestedMapping]);
                    });
                    return;
                  }

                  current = current[fieldPath[i]];
                }

                const finalField = fieldPath[fieldPath.length - 1];

                // Normalize boolean value if field exists
                if (current[finalField] !== undefined) {
                  current[finalField] = normalizeBooleanValue(current[finalField]);
                }
              }
            });
          };
          
          // Helper function to format postal codes based on province/state
          const formatPostalCode = (postalCode: string, province: string): string => {
            if (!postalCode || !province) return postalCode;
            
            // Clean the postal code (remove spaces, hyphens, etc.)
            const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();
            
            // Canadian provinces
            const canadianProvinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
            
            if (canadianProvinces.includes(province.toUpperCase())) {
              // Canadian postal code: A1A 1A1 format
              if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
                return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
              }
            } else {
              // US zip code: 12345 format (remove extended zip)
              if (/^\d{5}(\d{4})?$/.test(cleaned)) {
                return cleaned.substring(0, 5);
              }
            }
            
            // Return original if no formatting rules apply
            return postalCode;
          };
          
          // Helper function to format zone postal codes (startZone/endZone)
          const formatZonePostalCode = (postalCode: string): string => {
            if (!postalCode) return postalCode;
            
            // Clean the postal code (remove spaces, hyphens, etc.)
            const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();
            
            // Check if it matches Canadian postal code pattern
            if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
              return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
            }
            
            // Check if it matches US zip code pattern
            if (/^\d{5}(\d{4})?$/.test(cleaned)) {
              return cleaned.substring(0, 5);
            }
            
            // Return original if no formatting rules apply
            return postalCode;
          };
          
          // Helper function to recursively format postal codes in an object
          const formatPostalCodes = (obj: any) => {
            if (Array.isArray(obj)) {
              obj.forEach(item => formatPostalCodes(item));
            } else if (obj && typeof obj === 'object') {
              // Check if this object has both postalCode and province fields
              if (obj.postalCode && obj.province) {
                obj.postalCode = formatPostalCode(obj.postalCode, obj.province);
              }
              
              // Format startZone and endZone fields (these are standalone postal codes)
              if (obj.startZone) {
                obj.startZone = formatZonePostalCode(obj.startZone);
              }
              if (obj.endZone) {
                obj.endZone = formatZonePostalCode(obj.endZone);
              }
              
              // Recursively process nested objects
              for (const value of Object.values(obj)) {
                if (typeof value === 'object') {
                  formatPostalCodes(value);
                }
              }
            }
          };
          
          // Additional cleanup: recursively find and fix all null string values
          const cleanupNullStrings = (obj: any) => {
            if (Array.isArray(obj)) {
              obj.forEach(item => cleanupNullStrings(item));
            } else if (obj && typeof obj === 'object') {
              for (const [key, value] of Object.entries(obj)) {
                if (value === null || value === "null") {
                  // Check if this should be a string field based on field mappings
                  const mapping = regularMappings.find(m => m.fieldName.endsWith(key) || m.fieldName === key);
                  if (!mapping || mapping.dataType === 'string' || !mapping.dataType) {
                    obj[key] = "";
                  }
                } else if (typeof value === 'object') {
                  cleanupNullStrings(value);
                }
              }
            }
          };
          
          // Process each order in the orders array
          jsonData.orders.forEach((order: any) => {
            processObject(order, regularMappings);
            cleanupNullStrings(order);
            formatPostalCodes(order);
            
            // Filter out traceNumbers entries with null or empty traceNumber values
            if (order.traceNumbers && Array.isArray(order.traceNumbers)) {
              order.traceNumbers = order.traceNumbers.filter((trace: any) => {
                // Keep the trace entry only if traceNumber is not null, not an empty string, and not the string "null"
                return trace.traceNumber &&
                       trace.traceNumber !== "" &&
                       trace.traceNumber !== null &&
                       trace.traceNumber !== "null";
              });
            }
          });
        } else {
          // Even without field mappings, format postal codes
          const formatPostalCodes = (obj: any) => {
            if (Array.isArray(obj)) {
              obj.forEach(item => formatPostalCodes(item));
            } else if (obj && typeof obj === 'object') {
              // Check if this object has both postalCode and province fields
              if (obj.postalCode && obj.province) {
                const cleaned = obj.postalCode.replace(/[\s\-]/g, '').toUpperCase();
                const canadianProvinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
                
                if (canadianProvinces.includes(obj.province.toUpperCase())) {
                  // Canadian postal code: A1A 1A1 format
                  if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
                    obj.postalCode = `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
                  }
                } else {
                  // US zip code: 12345 format (remove extended zip)
                  if (/^\d{5}(\d{4})?$/.test(cleaned)) {
                    obj.postalCode = cleaned.substring(0, 5);
                  }
                }
              }
              
               // Format startZone and endZone fields (these are standalone postal codes)
               if (obj.startZone) {
                 const cleaned = obj.startZone.replace(/[\s\-]/g, '').toUpperCase();
                 // Check if it matches Canadian postal code pattern
                 if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
                   obj.startZone = `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
                 } else if (/^\d{5}(\d{4})?$/.test(cleaned)) {
                   // US zip code format
                   obj.startZone = cleaned.substring(0, 5);
                 }
               }
               if (obj.endZone) {
                 const cleaned = obj.endZone.replace(/[\s\-]/g, '').toUpperCase();
                 // Check if it matches Canadian postal code pattern
                 if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
                   obj.endZone = `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
                 } else if (/^\d{5}(\d{4})?$/.test(cleaned)) {
                   // US zip code format
                   obj.endZone = cleaned.substring(0, 5);
                 }
               }
               
              // Recursively process nested objects
              for (const value of Object.values(obj)) {
                if (typeof value === 'object') {
                  formatPostalCodes(value);
                }
              }
            }
          };
          
          // Format postal codes even without field mappings
          jsonData.orders.forEach((order: any) => {
            formatPostalCodes(order);
          });
        }

        // STEP 4: Remove fields marked with removeIfNull when they contain null/empty values
        if (regularMappings.length > 0) {
          const removeNullFields = (obj: any, mappings: any[]) => {
            mappings.forEach(mapping => {
              if (mapping.removeIfNull) {
                const fieldPath = mapping.fieldName.split('.');
                let current = obj;

                // Navigate to the parent of the field
                for (let i = 0; i < fieldPath.length - 1; i++) {
                  if (!current[fieldPath[i]]) {
                    return; // Path doesn't exist, nothing to remove
                  }

                  // If we encounter an array, process each item recursively
                  if (Array.isArray(current[fieldPath[i]])) {
                    const remainingPath = fieldPath.slice(i + 1).join('.');
                    const nestedMapping = { ...mapping, fieldName: remainingPath };
                    current[fieldPath[i]].forEach((item: any) => {
                      removeNullFields(item, [nestedMapping]);
                    });
                    return;
                  }

                  current = current[fieldPath[i]];
                }

                const finalField = fieldPath[fieldPath.length - 1];
                const fieldValue = current[finalField];

                // Remove field if value is null, empty string, undefined, or string "null"
                if (
                  fieldValue === null ||
                  fieldValue === "" ||
                  fieldValue === undefined ||
                  fieldValue === "null"
                ) {
                  delete current[finalField];
                }
              }
            });
          };

          // Process each order to remove null fields
          jsonData.orders.forEach((order: any) => {
            removeNullFields(order, regularMappings);
          });
        }

        // STEP 5: Evaluate function-type field mappings (including async address lookups)
        const functionMappings = fieldMappings.filter(m => m.type === 'function' && m.functionId);
        console.log(`[STEP 5] Function mappings found: ${functionMappings.length}, Functions available: ${functions.length}`);
        if (functionMappings.length > 0 && functions.length > 0) {
          const setFieldValue = (obj: any, fieldPath: string, value: any) => {
            const parts = fieldPath.split('.');
            let current = obj;
            for (let i = 0; i < parts.length - 1; i++) {
              if (current[parts[i]] === undefined) {
                current[parts[i]] = {};
              }
              if (Array.isArray(current[parts[i]])) {
                const remainingPath = parts.slice(i + 1).join('.');
                current[parts[i]].forEach((item: any) => {
                  setFieldValue(item, remainingPath, value);
                });
                return;
              }
              current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;
          };

          const isAddressLookupLogic = (logic: any): logic is AddressLookupFunctionLogic => {
            return logic && logic.type === 'address_lookup';
          };

          for (const order of jsonData.orders) {
            for (const mapping of functionMappings) {
              console.log(`[STEP 5] Processing mapping: fieldName=${mapping.fieldName}, functionId=${mapping.functionId}`);
              const func = functions.find(f => f.id === mapping.functionId);
              if (func && func.function_logic) {
                console.log(`[STEP 5] Found function: ${func.function_name}, type=${func.function_logic.type}`);
                let result: any;
                if (isAddressLookupLogic(func.function_logic)) {
                  console.log(`[STEP 5] Calling evaluateAddressLookup for ${mapping.fieldName}`);
                  result = await evaluateAddressLookup(func.function_logic, order);
                  console.log(`[STEP 5] Address lookup result: "${result}"`);
                } else {
                  result = evaluateFunction(func.function_logic, order);
                }
                if (result !== undefined && result !== '') {
                  console.log(`[STEP 5] Setting ${mapping.fieldName} = "${result}"`);
                  setFieldValue(order, mapping.fieldName, result);
                } else {
                  console.log(`[STEP 5] Result empty or undefined, not setting field`);
                }
              } else {
                console.log(`[STEP 5] Function not found for functionId=${mapping.functionId}`);
              }
            }
          }
        } else if (functionMappings.length > 0) {
          console.log(`[STEP 5] Skipped: functions array is empty`);
        }

        // STEP 6: Construct arrays from array entry configs
        if (enabledArrayEntries.length > 0) {
          console.log('[STEP 6] Processing array entry configs');
          console.log('[STEP 6 DEBUG] Raw workflowOnlyData string:', workflowOnlyData);

          // Parse workflowOnlyData to get extracted values
          let wfoData: Record<string, any> = {};
          try {
            wfoData = JSON.parse(workflowOnlyData);
            console.log('[STEP 6 DEBUG] Parsed wfoData successfully');
            console.log('[STEP 6 DEBUG] wfoData keys:', Object.keys(wfoData));
            console.log('[STEP 6 DEBUG] wfoData full contents:', JSON.stringify(wfoData, null, 2));
          } catch (parseErr) {
            console.warn('[STEP 6] Failed to parse workflowOnlyData for array entries:', parseErr);
          }

          // Separate repeating and static entries
          const repeatingEntries = enabledArrayEntries.filter(e => e.isRepeating);
          const staticEntries = enabledArrayEntries.filter(e => !e.isRepeating);

          // Group static entries by target array field
          const staticEntriesByArray = new Map<string, ArrayEntryConfig[]>();
          staticEntries.forEach(entry => {
            if (!staticEntriesByArray.has(entry.targetArrayField)) {
              staticEntriesByArray.set(entry.targetArrayField, []);
            }
            staticEntriesByArray.get(entry.targetArrayField)!.push(entry);
          });

          // Process each order
          jsonData.orders.forEach((order: any) => {
            // Track which arrays were populated by our repeating entry processing
            const populatedByRepeatingEntry = new Set<string>();

            // Process repeating entries first - they come from AI as arrays
            repeatingEntries.forEach(entry => {
              const repeatingKey = `__REPEATING_ARRAY_${entry.targetArrayField}__`;
              const extractedArray = wfoData[repeatingKey];

              if (Array.isArray(extractedArray) && extractedArray.length > 0) {
                // Process each extracted row, applying data type conversions
                const processedArray = extractedArray.map((row: Record<string, any>) => {
                  const processedRow: Record<string, any> = {};

                  entry.fields.forEach(field => {
                    let value: any;
                    if (field.fieldType === 'hardcoded') {
                      value = field.hardcodedValue || '';
                    } else {
                      value = row[field.fieldName];
                      if (value === undefined || value === null) {
                        value = '';
                      }
                    }

                    // Apply data type conversions
                    if (field.dataType === 'number') {
                      value = parseFloat(String(value)) || 0;
                    } else if (field.dataType === 'integer') {
                      value = parseInt(String(value)) || 0;
                    } else if (field.dataType === 'boolean') {
                      value = normalizeBooleanValue(value);
                    } else if (field.dataType === 'string' && value) {
                      value = String(value).toUpperCase();
                    }

                    processedRow[field.fieldName] = value;
                  });

                  return processedRow;
                }).filter((row: Record<string, any>) =>
                  Object.values(row).some(v => v !== '' && v !== null && v !== undefined && v !== 0)
                );

                if (processedArray.length > 0) {
                  order[entry.targetArrayField] = processedArray;
                  populatedByRepeatingEntry.add(entry.targetArrayField);
                  console.log(`[STEP 6] Constructed repeating ${entry.targetArrayField} array with ${processedArray.length} entries`);
                }

                // Clean up the temporary key
                delete wfoData[repeatingKey];
              } else {
                console.log(`[STEP 6] No repeating data found for ${entry.targetArrayField}`);
              }
            });

            // Process static entries
            staticEntriesByArray.forEach((entries, arrayField) => {
              // Only skip if a repeating entry from our config populated this array
              // (not if the AI just put data directly into the template)
              if (populatedByRepeatingEntry.has(arrayField)) {
                console.log(`[STEP 6] Skipping static entries for ${arrayField} - already populated by repeating entry`);
                return;
              }

              // Sort entries by entry order
              const sortedEntries = [...entries].sort((a, b) => a.entryOrder - b.entryOrder);

              console.log(`[STEP 6 DEBUG] Processing static entries for array: ${arrayField}`);
              console.log(`[STEP 6 DEBUG] Number of entries: ${sortedEntries.length}`);
              console.log(`[STEP 6 DEBUG] wfoData keys:`, Object.keys(wfoData));
              console.log(`[STEP 6 DEBUG] wfoData contents:`, JSON.stringify(wfoData, null, 2));

              // Build the array from entry configs
              const constructedArray: any[] = [];

              sortedEntries.forEach(entry => {
                console.log(`[STEP 6 DEBUG] Processing entry ${entry.entryOrder} for ${entry.targetArrayField}`);
                console.log(`[STEP 6 DEBUG]   isRepeating: ${entry.isRepeating}`);
                console.log(`[STEP 6 DEBUG]   fields count: ${entry.fields.length}`);

                if (!evaluateArrayEntryConditions(entry.conditions, order, wfoData)) {
                  console.log(`[STEP 6] Skipping array entry ${entry.entryOrder} for ${entry.targetArrayField} - conditions not met`);
                  return;
                }

                const entryObj: Record<string, any> = {};

                entry.fields.forEach(field => {
                  console.log(`[STEP 6 DEBUG]   Field: ${field.fieldName}`);
                  console.log(`[STEP 6 DEBUG]     fieldType: "${field.fieldType}" (type: ${typeof field.fieldType})`);
                  console.log(`[STEP 6 DEBUG]     hardcodedValue: "${field.hardcodedValue}"`);
                  console.log(`[STEP 6 DEBUG]     extractionInstruction: "${field.extractionInstruction}"`);
                  console.log(`[STEP 6 DEBUG]     dataType: "${field.dataType}"`);

                  if (field.fieldType === 'hardcoded') {
                    console.log(`[STEP 6 DEBUG]     -> Using HARDCODED path`);
                    // Use the hardcoded value
                    let value: any = field.hardcodedValue || '';
                    console.log(`[STEP 6 DEBUG]     -> Initial hardcoded value: "${value}"`);
                    // Convert based on data type
                    if (field.dataType === 'number') {
                      value = parseFloat(value) || 0;
                    } else if (field.dataType === 'integer') {
                      value = parseInt(value) || 0;
                    } else if (field.dataType === 'boolean') {
                      value = normalizeBooleanValue(value);
                    } else if (field.dataType === 'string') {
                      value = String(value).toUpperCase();
                    }
                    console.log(`[STEP 6 DEBUG]     -> Final value: "${value}"`);
                    entryObj[field.fieldName] = value;
                  } else if (field.fieldType === 'extracted' || field.fieldType === 'mapped') {
                    console.log(`[STEP 6 DEBUG]     -> Using EXTRACTED/MAPPED path`);
                    // Get the extracted value from workflowOnlyData
                    const extractionKey = `__ARRAY_ENTRY_${entry.targetArrayField}_${entry.entryOrder}_${field.fieldName}__`;
                    console.log(`[STEP 6 DEBUG]     -> Looking for key: "${extractionKey}"`);
                    console.log(`[STEP 6 DEBUG]     -> Key exists in wfoData: ${extractionKey in wfoData}`);
                    let value: any = wfoData[extractionKey] || '';
                    console.log(`[STEP 6 DEBUG]     -> Retrieved value: "${value}"`);
                    // Convert based on data type
                    if (field.dataType === 'number') {
                      value = parseFloat(value) || 0;
                    } else if (field.dataType === 'integer') {
                      value = parseInt(value) || 0;
                    } else if (field.dataType === 'boolean') {
                      value = normalizeBooleanValue(value);
                    } else if (field.dataType === 'string' && value) {
                      value = String(value).toUpperCase();
                    }
                    console.log(`[STEP 6 DEBUG]     -> Final value: "${value}"`);
                    entryObj[field.fieldName] = value;

                    // Remove the temporary key from workflowOnlyData
                    delete wfoData[extractionKey];
                  } else {
                    console.log(`[STEP 6 DEBUG]     -> UNKNOWN fieldType: "${field.fieldType}" - field will be SKIPPED!`);
                  }
                });

                console.log(`[STEP 6 DEBUG]   Constructed entryObj:`, JSON.stringify(entryObj));

                // Only add non-empty entries (entries must have at least one non-empty field value)
                const hasNonEmptyValue = Object.values(entryObj).some(v => v !== '' && v !== null && v !== undefined);
                if (hasNonEmptyValue) {
                  constructedArray.push(entryObj);
                }
              });

              // Set the constructed array on the order
              if (constructedArray.length > 0) {
                order[arrayField] = constructedArray;
                console.log(`[STEP 6] Constructed ${arrayField} array with ${constructedArray.length} entries`);
                console.log(`[STEP 6 DEBUG] Final array:`, JSON.stringify(order[arrayField], null, 2));
              }
            });
          });

          // Update workflowOnlyData to remove used extraction keys
          workflowOnlyData = JSON.stringify(wfoData);
        }

        templateData = JSON.stringify(jsonData);
      } catch (parseError) {
        console.warn('Could not parse JSON for post-processing:', parseError);
        // If parsing fails, we'll continue with the original content
      }

    } else {
      // XML format - no WFO support for XML currently
      extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

      templateData = extractedContent;
      workflowOnlyData = '{}';

      // Post-process XML with precise trimming to remove any extraneous content
      try {
        // Find the root element from the template
        const templateMatch = formatTemplate.match(/<(\w+)[^>]*>/);
        if (templateMatch) {
          const rootElement = templateMatch[1];

          // Find the first occurrence of the opening tag and last occurrence of the closing tag
          const openingTag = `<${rootElement}`;
          const closingTag = `</${rootElement}>`;

          const startIndex = templateData.indexOf(openingTag);
          const endIndex = templateData.lastIndexOf(closingTag);

          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            // Calculate the end position (include the closing tag)
            const endPosition = endIndex + closingTag.length;

            // Extract only the content between the first opening tag and last closing tag
            templateData = templateData.substring(startIndex, endPosition).trim();

            console.log(`XML trimmed: found ${rootElement} from position ${startIndex} to ${endPosition}`);
          } else {
            console.warn(`Could not find complete ${rootElement} structure in XML response`);
            // Try to find any XML-like content as fallback
            if (templateData.includes('<') && templateData.includes('>')) {
              console.warn('Using original XML content as fallback');
            } else {
              throw new Error(`No valid ${rootElement} XML structure found in AI response`);
            }
          }
        }
      } catch (parseError) {
        console.warn('XML post-processing failed:', parseError);
        // If post-processing fails completely, ensure we at least have some XML content
        if (!templateData.includes('<') || !templateData.includes('>')) {
          throw new Error('No valid XML content found in AI response');
        }
      }
    }

    // Validate the response format
    if (isJsonFormat) {
      // Validate JSON
      try {
        JSON.parse(templateData);
      } catch (error) {
        throw new Error('Invalid JSON response from AI. Please try again.');
      }
    } else {
      // Validate XML
      if (!templateData.includes('<?xml') && !templateData.includes('<')) {
        throw new Error('Invalid XML response from AI. Please try again.');
      }

      // Additional validation: ensure the XML contains the expected root element
      try {
        const templateMatch = formatTemplate.match(/<(\w+)[^>]*>/);
        if (templateMatch) {
          const rootElement = templateMatch[1];
          if (!templateData.includes(`<${rootElement}`)) {
            throw new Error(`XML response missing expected root element: ${rootElement}`);
          }
        }
      } catch (validationError) {
        console.warn('XML structure validation warning:', validationError);
        // Don't throw here, just log the warning
      }
    }

    return {
      templateData,
      workflowOnlyData
    };
  } catch (error) {
    console.error('Error extracting data from page:', error);
    throw new Error(`Failed to extract data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function extractJsonFromMultiPagePDF({
  pdfFiles,
  defaultInstructions,
  additionalInstructions,
  formatTemplate,
  fieldMappings = [],
  parseitIdMapping,
  traceTypeMapping,
  traceTypeValue,
  apiKey,
  arraySplitConfigs = [],
  functions = []
}: JsonMultiPageExtractionRequest): Promise<ExtractionResult> {
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured. Please add it in the API settings.');
  }

  if (!pdfFiles || pdfFiles.length === 0) {
    throw new Error('At least one PDF file is required');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const activeModelName = await getActiveModelName();
    const model = genAI.getGenerativeModel({ model: activeModelName });

    const pdfBase64Array = await Promise.all(
      pdfFiles.map(file => fileToBase64(file))
    );

    const fullInstructions = additionalInstructions
      ? `${defaultInstructions}\n\nAdditional Instructions: ${additionalInstructions}`
      : defaultInstructions;

    const regularMappings = fieldMappings.filter(m => !m.isWorkflowOnly);
    const wfoMappings = fieldMappings.filter(m => m.isWorkflowOnly);

    console.log(`[extractJsonFromMultiPagePDF] Total field mappings: ${fieldMappings.length}`);
    console.log(`[extractJsonFromMultiPagePDF] Regular mappings: ${regularMappings.length}`);
    console.log(`[extractJsonFromMultiPagePDF] WFO mappings: ${wfoMappings.length}`);
    console.log(`[extractJsonFromMultiPagePDF] Processing ${pdfFiles.length} pages together`);

    const postalCodeRules = `

POSTAL CODE FORMATTING RULES:
- Canadian Postal Codes: Always format as "AAA AAA" (3 letters, space, 3 letters/numbers) - Example: "H1W 1S3" not "H1W1S3"
- US Zip Codes: Always format as "11111" (5 digits, no spaces or dashes) - Example: "90210" not "90210-1234"
- If you detect a Canadian postal code pattern (letter-number-letter number-letter-number), add the space: "H1W1S3" becomes "H1W 1S3"
- If you detect a US zip code pattern, use only the first 5 digits: "90210-1234" becomes "90210"

PROVINCE AND STATE FORMATTING RULES:
- Canadian Provinces: Always format as 2-letter code only - Example: "BC" not "British Columbia", "ON" not "Ontario"
- US States: Always format as 2-letter code only - Example: "WA" not "Washington", "CA" not "California"
- If you detect a full province or state name, convert it to the 2-letter code
- Valid Canadian province codes: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT
- Valid US state codes: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY`;

    let fieldMappingInstructions = '';
    if (regularMappings.length > 0) {
      fieldMappingInstructions = '\n\nFIELD MAPPING INSTRUCTIONS:\n';
      regularMappings.forEach(mapping => {
        const getDateTimeNote = (m: any) => m.dateOnly
          ? ' (as date string in yyyy-MM-dd format)'
          : ' (as datetime string in yyyy-MM-ddThh:mm:ss format)';
        if (mapping.type === 'hardcoded') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (as formatted phone number XXX-XXX-XXXX)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": Always use the EXACT hardcoded value "${mapping.value}"${dataTypeNote}\n`;
        } else if (mapping.type === 'mapped') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`;
        } else {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}\n`;
        }
      });
    }

    let parseitIdInstructions = '';
    if (parseitIdMapping) {
      parseitIdInstructions = `\n\nPARSE-IT ID MAPPING:\n- "${parseitIdMapping}": This field will be automatically populated with a unique Parse-It ID number. For now, use the placeholder value "{{PARSE_IT_ID_PLACEHOLDER}}" (this will be replaced automatically).\n`;
    }

    let traceTypeInstructions = '';
    if (traceTypeMapping && traceTypeValue) {
      traceTypeInstructions = `\n\nTRACE TYPE MAPPING:\n- "${traceTypeMapping}": Always set this field to the exact value "${traceTypeValue}".\n`;
    }

    let arraySplitInstructions = '';
    if (arraySplitConfigs && arraySplitConfigs.length > 0) {
      arraySplitInstructions = '\n\nARRAY SPLIT INSTRUCTIONS:\n';
      arraySplitConfigs.forEach(config => {
        if (config.splitStrategy === 'one_per_entry') {
          const fallbackInstruction = config.defaultToOneIfMissing
            ? ` If the "${config.splitBasedOnField}" field is not found, empty, or has a value of 0, create 1 entry in the "${config.targetArrayField}" array with "${config.splitBasedOnField}" set to 1.`
            : '';
          arraySplitInstructions += `- For the "${config.targetArrayField}" array: Look at the value of the "${config.splitBasedOnField}" field in the document. If this field has a value of N (for example, if "${config.splitBasedOnField}" = 3), create N separate entries in the "${config.targetArrayField}" array. Each entry should have "${config.splitBasedOnField}" set to 1, and all other fields should contain the same data from the document. For example, if pieces = 3, create 3 barcode entries each with pieces = 1.${fallbackInstruction}\n`;
        } else {
          const fallbackInstruction = config.defaultToOneIfMissing
            ? ` If the "${config.splitBasedOnField}" field is not found, empty, or has a value of 0, create 1 entry in the "${config.targetArrayField}" array.`
            : '';
          arraySplitInstructions += `- For the "${config.targetArrayField}" array: Look at the value of the "${config.splitBasedOnField}" field and create multiple entries distributing the value evenly across them based on the data in the document.${fallbackInstruction}\n`;
        }
      });
    }

    let wfoInstructions = '';
    if (wfoMappings.length > 0) {
      wfoInstructions = '\n\nWORKFLOW-ONLY FIELDS (SEPARATE EXTRACTION):\n';
      wfoInstructions += 'Extract these additional fields as standalone variables for workflow use (NOT part of the main template structure):\n';
      wfoMappings.forEach(mapping => {
        const getDateTimeNote = (m: any) => m.dateOnly
          ? ' (as date string in yyyy-MM-dd format)'
          : ' (as datetime string in yyyy-MM-ddThh:mm:ss format)';
        if (mapping.type === 'hardcoded') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (as formatted phone number XXX-XXX-XXXX)' : '';
          wfoInstructions += `- "${mapping.fieldName}": Always use the EXACT hardcoded value "${mapping.value}"${dataTypeNote}\n`;
        } else if (mapping.type === 'mapped') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' : '';
          wfoInstructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`;
        } else {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                              mapping.dataType === 'number' ? ' (format as number)' :
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? getDateTimeNote(mapping) :
                              mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' : '';
          wfoInstructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}\n`;
        }
      });
    }

    const hasWFOFields = wfoMappings.length > 0;
    const prompt = `
You are a data extraction AI analyzing ${pdfFiles.length} PDF pages that belong to the SAME document and must be processed together as ONE complete document.

⚠️ CRITICAL: These ${pdfFiles.length} pages are from the SAME PDF document. You must analyze ALL pages together and extract the complete information across all pages to produce a SINGLE JSON output.

EXTRACTION INSTRUCTIONS:
${fullInstructions}${fieldMappingInstructions}${parseitIdInstructions}${traceTypeInstructions}${arraySplitInstructions}${wfoInstructions}${postalCodeRules}

OUTPUT FORMAT:
${hasWFOFields ? 'You need to extract TWO separate data structures from the PDF:\n\n1. MAIN TEMPLATE DATA:\n' : ''}Please format the extracted data as JSON following this EXACT JSON structure:
${formatTemplate}${hasWFOFields ? '\n\n2. WORKFLOW-ONLY DATA:\nProvide the workflow-only fields as a separate JSON object with the field names as keys and their extracted values.\n\nIMPORTANT: Return BOTH structures in a wrapper object like this:\n{\n  "templateData": <your extracted template data here>,\n  "workflowOnlyData": {\n    <workflow field name>: <extracted value>,\n    ...\n  }\n}\n\nIf there are no workflow-only fields, set workflowOnlyData to an empty object {}.' : ''}

IMPORTANT GUIDELINES:
1. Process ALL ${pdfFiles.length} pages together - they are part of the same document
2. Extract information from across all pages to create one complete JSON output
3. Only extract information that is clearly visible in the document
4. CRITICAL: Follow the EXACT structure provided in the template. Do not add extra fields at the root level or change the nesting structure
5. If a field is not found, use empty string ("") for text fields, 0 for numbers, null for fields that should be null, or [] for arrays. For datetime fields that are empty, use today's date in yyyy-MM-ddThh:mm:ss format
6. Maintain the exact JSON structure provided and preserve exact case for all hardcoded values
7. Do NOT duplicate fields outside of their proper nested structure
8. Ensure valid JSON syntax with proper quotes and brackets
9. Use appropriate data types (dates, numbers, text). For JSON, ensure empty values are represented as empty strings (""), not "N/A". CRITICAL: For hardcoded values, use the EXACT case as specified (e.g., "True" not "true", "False" not "false"). For datetime fields, use the format yyyy-MM-ddThh:mm:ss (e.g., "2024-03-15T14:30:00"). If a datetime field is empty or not found, use today's date and current time in the same format. CRITICAL: For all string data type fields (dataType="string"), convert the extracted value to UPPER CASE before including it in the output
10. Be precise and accurate with the extracted data
11. CRITICAL: For JSON output, the ONLY top-level key allowed is "orders". Do NOT include any other top-level keys or duplicate fields at the root level. Return ONLY the JSON structure from the template - no additional fields outside the "orders" array.

Please provide only the JSON output without any additional explanation or formatting.
`;

    const parts = [
      ...pdfBase64Array.map(base64 => ({
        inlineData: {
          mimeType: 'application/pdf',
          data: base64
        }
      })),
      prompt
    ];

    const result = await withRetry(
      () => model.generateContent(parts),
      'Gemini API JSON multi-page extraction'
    );

    const response = await result.response;
    let extractedContent = response.text();

    let templateData: string;
    let workflowOnlyData: string = '{}';

    extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    if (hasWFOFields) {
      try {
        const wrapper = JSON.parse(extractedContent);
        if (wrapper.templateData && wrapper.workflowOnlyData !== undefined) {
          templateData = typeof wrapper.templateData === 'string'
            ? wrapper.templateData
            : JSON.stringify(wrapper.templateData);
          workflowOnlyData = typeof wrapper.workflowOnlyData === 'string'
            ? wrapper.workflowOnlyData
            : JSON.stringify(wrapper.workflowOnlyData);
          console.log('[extractJsonFromMultiPagePDF] Successfully parsed dual-structure response');
          console.log('[extractJsonFromMultiPagePDF] Template data length:', templateData.length);
          console.log('[extractJsonFromMultiPagePDF] WFO data:', workflowOnlyData);
        } else {
          console.warn('[extractJsonFromMultiPagePDF] Wrapper missing expected fields, using full response as template');
          templateData = extractedContent;
          workflowOnlyData = '{}';
        }
      } catch (wrapperError) {
        console.warn('[extractJsonFromMultiPagePDF] Failed to parse wrapper, using full response as template:', wrapperError);
        templateData = extractedContent;
        workflowOnlyData = '{}';
      }
    } else {
      templateData = extractedContent;
    }

    try {
      let jsonData = JSON.parse(templateData);

      const allowedTopLevelKeys = ['orders'];
      const keysToRemove = Object.keys(jsonData).filter(key => !allowedTopLevelKeys.includes(key));
      keysToRemove.forEach(key => {
        delete jsonData[key];
      });

      if (!jsonData.orders || !Array.isArray(jsonData.orders)) {
        jsonData.orders = [];
      }

      if (regularMappings.length > 0) {
        const currentDateTime = new Date().toISOString().slice(0, 19);

        const processObject = (obj: any, mappings: any[]) => {
          mappings.forEach(mapping => {
            if (mapping.dataType === 'datetime') {
              const fieldPath = mapping.fieldName.split('.');
              let current = obj;

              for (let i = 0; i < fieldPath.length - 1; i++) {
                if (current[fieldPath[i]] === undefined) {
                  current[fieldPath[i]] = {};
                }

                if (Array.isArray(current[fieldPath[i]])) {
                  const remainingPath = fieldPath.slice(i + 1).join('.');
                  const nestedMapping = { ...mapping, fieldName: remainingPath };
                  current[fieldPath[i]].forEach((item: any) => {
                    processObject(item, [nestedMapping]);
                  });
                  return;
                }

                current = current[fieldPath[i]];
              }

              const finalField = fieldPath[fieldPath.length - 1];

              if (!current[finalField] || current[finalField] === "" || current[finalField] === "N/A") {
                if (mapping.type === 'hardcoded' && mapping.value) {
                  current[finalField] = mapping.value;
                } else {
                  current[finalField] = currentDateTime;
                }
              }

              // For dateOnly fields, ensure time is set to 00:00:00
              if (mapping.dateOnly && current[finalField]) {
                const dateValue = String(current[finalField]);
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                  current[finalField] = `${dateValue}T00:00:00`;
                } else if (/^\d{4}-\d{2}-\d{2}T/.test(dateValue)) {
                  current[finalField] = `${dateValue.slice(0, 10)}T00:00:00`;
                }
              }
            } else if (mapping.dataType === 'phone') {
              const fieldPath = mapping.fieldName.split('.');
              let current = obj;

              for (let i = 0; i < fieldPath.length - 1; i++) {
                if (current[fieldPath[i]] === undefined) {
                  current[fieldPath[i]] = {};
                }

                if (Array.isArray(current[fieldPath[i]])) {
                  const remainingPath = fieldPath.slice(i + 1).join('.');
                  const nestedMapping = { ...mapping, fieldName: remainingPath };
                  current[fieldPath[i]].forEach((item: any) => {
                    processObject(item, [nestedMapping]);
                  });
                  return;
                }

                current = current[fieldPath[i]];
              }

              const finalField = fieldPath[fieldPath.length - 1];

              if (current[finalField]) {
                const formatted = formatPhoneNumber(String(current[finalField]));
                if (formatted) {
                  current[finalField] = formatted;
                }
              }
            }
          });
        };

        jsonData.orders.forEach((order: any) => {
          processObject(order, regularMappings);
        });
      }

      // Evaluate function-type field mappings (including async address lookups)
      const functionMappings = fieldMappings.filter(m => m.type === 'function' && m.functionId);
      if (functionMappings.length > 0 && functions.length > 0) {
        const setFieldValue = (obj: any, fieldPath: string, value: any) => {
          const parts = fieldPath.split('.');
          let current = obj;
          for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
              current[parts[i]] = {};
            }
            if (Array.isArray(current[parts[i]])) {
              const remainingPath = parts.slice(i + 1).join('.');
              current[parts[i]].forEach((item: any) => {
                setFieldValue(item, remainingPath, value);
              });
              return;
            }
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = value;
        };

        const isAddressLookupLogic = (logic: any): logic is AddressLookupFunctionLogic => {
          return logic && logic.type === 'address_lookup';
        };

        for (const order of jsonData.orders) {
          for (const mapping of functionMappings) {
            const func = functions.find(f => f.id === mapping.functionId);
            if (func && func.function_logic) {
              let result: any;
              if (isAddressLookupLogic(func.function_logic)) {
                result = await evaluateAddressLookup(func.function_logic, order);
              } else {
                result = evaluateFunction(func.function_logic, order);
              }
              if (result !== undefined && result !== '') {
                setFieldValue(order, mapping.fieldName, result);
              }
            }
          }
        }
      }

      templateData = JSON.stringify(jsonData);
    } catch (jsonError) {
      console.warn('[extractJsonFromMultiPagePDF] JSON post-processing failed, using raw data:', jsonError);
    }

    console.log('[extractJsonFromMultiPagePDF] ✅ Multi-page extraction successful');

    return {
      templateData,
      workflowOnlyData
    };
  } catch (error) {
    console.error('[extractJsonFromMultiPagePDF] Error during extraction:', error);
    throw error;
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}