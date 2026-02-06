import { FieldMapping, ArrayEntryConfig } from '../index.ts';
import { truncateJsonEscaped, formatPhoneNumber, normalizeBooleanValue } from './utils.ts';

const CANADIAN_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

function formatPostalCode(postalCode: string, province: string): string {
  if (!postalCode || !province) return postalCode;

  const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();

  if (CANADIAN_PROVINCES.includes(province.toUpperCase())) {
    if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
    }
  } else {
    if (/^\d{5}(\d{4})?$/.test(cleaned)) {
      return cleaned.substring(0, 5);
    }
  }

  return postalCode;
}

function formatZonePostalCode(postalCode: string): string {
  if (!postalCode) return postalCode;

  const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();

  if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
  }

  if (/^\d{5}(\d{4})?$/.test(cleaned)) {
    return cleaned.substring(0, 5);
  }

  return postalCode;
}

function formatPostalCodes(obj: any): void {
  if (Array.isArray(obj)) {
    obj.forEach(item => formatPostalCodes(item));
  } else if (obj && typeof obj === 'object') {
    if (obj.postalCode && obj.province) {
      obj.postalCode = formatPostalCode(obj.postalCode, obj.province);
    }

    if (obj.startZone) {
      obj.startZone = formatZonePostalCode(obj.startZone);
    }
    if (obj.endZone) {
      obj.endZone = formatZonePostalCode(obj.endZone);
    }

    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        formatPostalCodes(value);
      }
    }
  }
}

function processObject(obj: any, mappings: FieldMapping[]): void {
  const currentDateTime = new Date().toISOString().slice(0, 19);

  mappings.forEach(mapping => {
    if (mapping.dataType === 'datetime') {
      processDatetimeField(obj, mapping, currentDateTime);
    } else if (mapping.dataType === 'phone') {
      processPhoneField(obj, mapping);
    } else if (mapping.dataType === 'string' || !mapping.dataType) {
      processStringField(obj, mapping);
    } else if (mapping.dataType === 'boolean') {
      processBooleanField(obj, mapping);
    }
  });
}

function processDatetimeField(obj: any, mapping: FieldMapping, currentDateTime: string): void {
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
}

function processPhoneField(obj: any, mapping: FieldMapping): void {
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

  if (current[finalField] && typeof current[finalField] === 'string') {
    const formattedPhone = formatPhoneNumber(current[finalField]);
    current[finalField] = formattedPhone || "";
  }
}

function processStringField(obj: any, mapping: FieldMapping): void {
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

  if (current[finalField] === null || current[finalField] === "null") {
    current[finalField] = "";
  }

  if (typeof current[finalField] === 'string' && current[finalField] !== "") {
    current[finalField] = current[finalField].toUpperCase();
  }

  if (mapping.maxLength && typeof mapping.maxLength === 'number' && mapping.maxLength > 0) {
    if (typeof current[finalField] === 'string') {
      const jsonEscapedLength = JSON.stringify(current[finalField]).length - 2;
      if (jsonEscapedLength > mapping.maxLength) {
        current[finalField] = truncateJsonEscaped(current[finalField], mapping.maxLength);
      }
    }
  }
}

function processBooleanField(obj: any, mapping: FieldMapping): void {
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

  if (current[finalField] !== undefined) {
    current[finalField] = normalizeBooleanValue(current[finalField]);
  }
}

function cleanupNullStrings(obj: any, regularMappings: FieldMapping[]): void {
  if (Array.isArray(obj)) {
    obj.forEach(item => cleanupNullStrings(item, regularMappings));
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === "null" || value === "N/A" || value === "n/a") {
        const mapping = regularMappings.find(m => m.fieldName.endsWith(key) || m.fieldName === key);
        if (!mapping || mapping.dataType === 'string' || !mapping.dataType) {
          obj[key] = "";
        }
      } else if (typeof value === 'object') {
        cleanupNullStrings(value, regularMappings);
      }
    }
  }
}

function removeNullFields(obj: any, mappings: FieldMapping[]): void {
  mappings.forEach(mapping => {
    if (!mapping.removeIfNull) return;

    const fieldPath = mapping.fieldName.split('.');
    let current = obj;

    for (let i = 0; i < fieldPath.length - 1; i++) {
      if (!current[fieldPath[i]]) {
        return;
      }

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

    if (
      fieldValue === null ||
      fieldValue === "" ||
      fieldValue === undefined ||
      fieldValue === "null"
    ) {
      delete current[finalField];
    }
  });
}

export function applyFieldMappingPostProcessing(jsonData: any, fieldMappings: FieldMapping[]): any {
  const regularMappings = fieldMappings.filter(m => !m.isWorkflowOnly);
  if (regularMappings.length === 0 && (!jsonData.orders || !Array.isArray(jsonData.orders))) {
    return jsonData;
  }

  if (jsonData.orders && Array.isArray(jsonData.orders)) {
    jsonData.orders.forEach((order: any) => {
      if (regularMappings.length > 0) {
        processObject(order, regularMappings);
        removeNullFields(order, regularMappings);
      }
      cleanupNullStrings(order, regularMappings);
      formatPostalCodes(order);

      if (order.traceNumbers && Array.isArray(order.traceNumbers)) {
        order.traceNumbers = order.traceNumbers.filter((trace: any) => {
          return trace.traceNumber &&
                 trace.traceNumber !== "" &&
                 trace.traceNumber !== null &&
                 trace.traceNumber !== "null";
        });
      }
    });
  }

  return jsonData;
}

export function constructArraysFromEntryConfigs(
  jsonData: any,
  arrayEntryConfigs: ArrayEntryConfig[],
  workflowOnlyData: Record<string, any>
): void {
  const enabledEntries = arrayEntryConfigs.filter(e => e.isEnabled);
  console.log(`[ArrayEntryBuilder] Enabled entries: ${enabledEntries.length}, Total configs: ${arrayEntryConfigs.length}`);
  if (enabledEntries.length === 0) return;

  // Separate repeating and static entries
  const repeatingEntries = enabledEntries.filter(e => e.isRepeating);
  const staticEntries = enabledEntries.filter(e => !e.isRepeating);
  console.log(`[ArrayEntryBuilder] Repeating entries: ${repeatingEntries.length}, Static entries: ${staticEntries.length}`);

  // Group static entries by target array field
  const staticEntriesByArray = new Map<string, ArrayEntryConfig[]>();
  staticEntries.forEach(entry => {
    if (!staticEntriesByArray.has(entry.targetArrayField)) {
      staticEntriesByArray.set(entry.targetArrayField, []);
    }
    staticEntriesByArray.get(entry.targetArrayField)!.push(entry);
  });

  if (jsonData.orders && Array.isArray(jsonData.orders)) {
    jsonData.orders.forEach((order: any) => {
      const repeatingPopulatedArrays = new Set<string>();

      // Process repeating entries first - they come from AI as arrays
      repeatingEntries.forEach(entry => {
        const repeatingKey = `__REPEATING_ARRAY_${entry.targetArrayField}__`;
        const extractedArray = workflowOnlyData[repeatingKey];

        if (Array.isArray(extractedArray) && extractedArray.length > 0) {
          // Process each extracted row, applying data type conversions
          const processedArray = extractedArray.map((row: Record<string, any>) => {
            const processedRow: Record<string, any> = {};

            entry.fields.forEach(field => {
              let value: any;
              console.log(`[ArrayEntryBuilder] Processing field "${field.fieldName}" - fieldType: "${field.fieldType}", hardcodedValue: "${field.hardcodedValue}"`);
              if (field.fieldType === 'hardcoded') {
                value = field.hardcodedValue || '';
                console.log(`[ArrayEntryBuilder] Using HARDCODED value: "${value}"`);
              } else {
                value = row[field.fieldName];
                console.log(`[ArrayEntryBuilder] Using AI-extracted value: "${value}"`);
                if (value === undefined || value === null) {
                  value = '';
                }
              }

              // Apply data type conversions
              if (field.dataType === 'number') {
                value = parseFloat(String(value)) || 0;
              } else if (field.dataType === 'integer') {
                value = parseInt(String(value)) || 0;
              } else if (field.dataType === 'string' && value) {
                value = String(value).toUpperCase();
              }

              // Check removeIfNull - skip field if value is empty/null
              if (field.removeIfNull && (value === null || value === '' || value === undefined || value === 'null')) {
                console.log(`[ArrayEntryBuilder] Skipping field "${field.fieldName}" due to removeIfNull (value: "${value}")`);
                return;
              }

              processedRow[field.fieldName] = value;
            });

            return processedRow;
          }).filter((row: Record<string, any>) =>
            Object.values(row).some(v => v !== '' && v !== null && v !== undefined && v !== 0)
          );

          if (processedArray.length > 0) {
            order[entry.targetArrayField] = processedArray;
            repeatingPopulatedArrays.add(entry.targetArrayField);
            console.log(`[ArrayEntryBuilder] Constructed repeating ${entry.targetArrayField} array with ${processedArray.length} entries`);
          } else {
            delete order[entry.targetArrayField];
            console.log(`[ArrayEntryBuilder] Removed empty repeating array ${entry.targetArrayField} from output`);
          }

          // Clean up the temporary key
          delete workflowOnlyData[repeatingKey];
        } else {
          console.log(`[ArrayEntryBuilder] No repeating data found for ${entry.targetArrayField}`);
        }
      });

      // Process static entries
      staticEntriesByArray.forEach((entries, arrayField) => {
        // Only skip if a repeating entry explicitly populated this array
        if (repeatingPopulatedArrays.has(arrayField)) {
          console.log(`[ArrayEntryBuilder] Skipping static entries for ${arrayField} - already populated by repeating entry`);
          return;
        }

        const sortedEntries = [...entries].sort((a, b) => a.entryOrder - b.entryOrder);
        const constructedArray: any[] = [];

        sortedEntries.forEach(entry => {
          if (entry.aiConditionInstruction) {
            const conditionKey = `__ARRAY_ENTRY_CONDITION_${entry.targetArrayField}_${entry.entryOrder}__`;
            const conditionResult = String(workflowOnlyData[conditionKey] || '').toLowerCase();
            delete workflowOnlyData[conditionKey];

            if (conditionResult !== 'true') {
              console.log(`[ArrayEntryBuilder] Skipping ${entry.targetArrayField}[${entry.entryOrder}] - AI condition not met (result: "${conditionResult}")`);
              entry.fields.forEach(f => {
                const key = `__ARRAY_ENTRY_${entry.targetArrayField}_${entry.entryOrder}_${f.fieldName}__`;
                delete workflowOnlyData[key];
              });
              return;
            }
            console.log(`[ArrayEntryBuilder] AI condition met for ${entry.targetArrayField}[${entry.entryOrder}]`);
          }

          const entryObj: Record<string, any> = {};

          entry.fields.forEach(field => {
            if (field.fieldType === 'hardcoded') {
              let value: any = field.hardcodedValue || '';
              if (field.dataType === 'number') {
                value = parseFloat(value) || 0;
              } else if (field.dataType === 'integer') {
                value = parseInt(value) || 0;
              } else if (field.dataType === 'string') {
                value = String(value).toUpperCase();
              }
              // Check removeIfNull - skip field if value is empty/null
              if (field.removeIfNull && (value === null || value === '' || value === undefined || value === 'null')) {
                console.log(`[ArrayEntryBuilder] Skipping hardcoded field "${field.fieldName}" due to removeIfNull`);
                return;
              }
              entryObj[field.fieldName] = value;
            } else if (field.fieldType === 'extracted' || field.fieldType === 'mapped') {
              const extractionKey = `__ARRAY_ENTRY_${entry.targetArrayField}_${entry.entryOrder}_${field.fieldName}__`;
              let value: any = workflowOnlyData[extractionKey] || '';
              if (field.dataType === 'number') {
                value = parseFloat(value) || 0;
              } else if (field.dataType === 'integer') {
                value = parseInt(value) || 0;
              } else if (field.dataType === 'string' && value) {
                value = String(value).toUpperCase();
              }
              // Check removeIfNull - skip field if value is empty/null
              if (field.removeIfNull && (value === null || value === '' || value === undefined || value === 'null')) {
                console.log(`[ArrayEntryBuilder] Skipping extracted field "${field.fieldName}" due to removeIfNull`);
                delete workflowOnlyData[extractionKey];
                return;
              }
              entryObj[field.fieldName] = value;
              delete workflowOnlyData[extractionKey];
            }
          });

          const hasNonEmptyValue = Object.values(entryObj).some(v => v !== '' && v !== null && v !== undefined);
          if (hasNonEmptyValue) {
            constructedArray.push(entryObj);
          }
        });

        if (constructedArray.length > 0) {
          order[arrayField] = constructedArray;
          console.log(`[ArrayEntryBuilder] Constructed ${arrayField} array with ${constructedArray.length} entries`);
        } else {
          delete order[arrayField];
          console.log(`[ArrayEntryBuilder] Removed empty array ${arrayField} from output - no entries constructed`);
        }
      });
    });
  }
}

export function parseExtractionResponse(
  extractedContent: string,
  isJsonFormat: boolean,
  hasWFOFields: boolean
): { templateData: string; workflowOnlyData: string; extractedContent: string } {
  let templateData = '';
  let workflowOnlyData = '{}';

  if (isJsonFormat) {
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
          console.log('Successfully parsed dual-structure response');
          extractedContent = templateData;
        } else {
          console.warn('Wrapper missing expected fields, using full response as template');
          templateData = extractedContent;
          workflowOnlyData = '{}';
        }
      } catch (wrapperError) {
        console.warn('Failed to parse wrapper, using full response as template:', wrapperError);
        templateData = extractedContent;
        workflowOnlyData = '{}';
      }
    } else {
      templateData = extractedContent;
    }
  } else {
    extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

    if (!extractedContent.startsWith('<') || !extractedContent.endsWith('>')) {
      throw new Error('AI returned invalid XML format');
    }
  }

  return { templateData, workflowOnlyData, extractedContent };
}
