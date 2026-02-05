import type { FieldMapping } from '../types';

function truncateJsonEscaped(str: string, maxLength: number): string {
  if (!str || maxLength <= 0) {
    return '';
  }

  const getJsonEscapedLength = (s: string): number => {
    return JSON.stringify(s).length - 2;
  };

  if (getJsonEscapedLength(str) <= maxLength) {
    return str;
  }

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

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    const tenDigits = digits.slice(1);
    return `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`;
  }

  return "";
}

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

function getFieldValue(obj: any, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

function setFieldValue(obj: any, fieldPath: string, value: any): void {
  const parts = fieldPath.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }

  current[parts[parts.length - 1]] = value;
}

function deleteFieldValue(obj: any, fieldPath: string): void {
  const parts = fieldPath.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) {
      return;
    }
    current = current[parts[i]];
  }

  delete current[parts[parts.length - 1]];
}

function isFieldPathReference(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('(') || value.includes(',')) return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+$/.test(value);
}

function isArrayPath(obj: any, fieldPath: string): { isArray: boolean; arrayKey: string; fieldKey: string } {
  const parts = fieldPath.split('.');
  if (parts.length < 2) return { isArray: false, arrayKey: '', fieldKey: '' };

  const firstPart = parts[0];
  if (obj[firstPart] && Array.isArray(obj[firstPart])) {
    return { isArray: true, arrayKey: firstPart, fieldKey: parts.slice(1).join('.') };
  }
  return { isArray: false, arrayKey: '', fieldKey: '' };
}

function processArrayRemoveIfNull(order: any, mapping: FieldMapping): void {
  const { isArray, arrayKey, fieldKey } = isArrayPath(order, mapping.fieldName);
  if (!isArray || !fieldKey) return;

  const arr = order[arrayKey];
  if (!Array.isArray(arr)) return;

  for (const item of arr) {
    const value = getFieldValue(item, fieldKey);
    if (value === null || value === undefined || value === '' || value === 'null') {
      deleteFieldValue(item, fieldKey);
      console.log(`[FieldMappingProcessor] Removed ${mapping.fieldName} from array item due to removeIfNull`);
    }
  }
}

function cleanupEmptyArrayItems(order: any): void {
  for (const key of Object.keys(order)) {
    if (Array.isArray(order[key])) {
      order[key] = order[key].filter((item: any) => {
        if (typeof item !== 'object' || item === null) return true;
        return Object.keys(item).length > 0;
      });

      if (order[key].length === 0) {
        delete order[key];
        console.log(`[FieldMappingProcessor] Removed empty array: ${key}`);
      }
    }
  }
}

export function applyFieldMappingPostProcessing(
  data: { orders: any[] },
  fieldMappings: FieldMapping[]
): { orders: any[] } {
  if (!data?.orders || !Array.isArray(data.orders) || fieldMappings.length === 0) {
    return data;
  }

  console.log('[FieldMappingProcessor] Starting post-processing with', fieldMappings.length, 'mappings');

  for (const order of data.orders) {
    for (const mapping of fieldMappings) {
      const fieldPath = mapping.fieldName;
      let value = getFieldValue(order, fieldPath);

      if ((mapping.type === 'mapped' || mapping.type === 'ai') && mapping.value && isFieldPathReference(mapping.value)) {
        const sourceValue = getFieldValue(order, mapping.value);
        if (sourceValue !== undefined) {
          console.log(`[FieldMappingProcessor] Resolving field reference: ${fieldPath} <- ${mapping.value} = "${sourceValue}"`);
          value = sourceValue;
          setFieldValue(order, fieldPath, value);
        } else {
          console.log(`[FieldMappingProcessor] Field reference source not found: ${mapping.value}`);
        }
      }

      if (value === undefined && mapping.type !== 'hardcoded') {
        continue;
      }

      if (mapping.dataType === 'string' || !mapping.dataType) {
        if (value === null || value === 'null') {
          value = '';
        }

        if (typeof value === 'string' && value !== '') {
          value = value.toUpperCase();
        }

        if (mapping.maxLength && typeof mapping.maxLength === 'number' && mapping.maxLength > 0) {
          if (typeof value === 'string') {
            const jsonEscapedLength = JSON.stringify(value).length - 2;
            if (jsonEscapedLength > mapping.maxLength) {
              value = truncateJsonEscaped(value, mapping.maxLength);
              console.log(`[FieldMappingProcessor] Truncated ${fieldPath} to maxLength ${mapping.maxLength}`);
            }
          }
        }

        setFieldValue(order, fieldPath, value);
      } else if (mapping.dataType === 'phone') {
        if (value && typeof value === 'string') {
          const formattedPhone = formatPhoneNumber(value);
          setFieldValue(order, fieldPath, formattedPhone);
        }
      } else if (mapping.dataType === 'boolean') {
        const normalizedValue = normalizeBooleanValue(value);
        setFieldValue(order, fieldPath, normalizedValue);
      } else if (mapping.dataType === 'datetime') {
        if (value) {
          const dateValue = String(value);
          if (mapping.dateOnly) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
              value = `${dateValue}T00:00:00`;
            } else if (/^\d{4}-\d{2}-\d{2}T/.test(dateValue)) {
              value = `${dateValue.slice(0, 10)}T00:00:00`;
            }
          } else {
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateValue)) {
              value = `${dateValue}:00`;
            }
          }
          setFieldValue(order, fieldPath, value);
        }
      } else if (mapping.dataType === 'zip_postal') {
        if (value && typeof value === 'string') {
          const cleaned = value.replace(/\s+/g, '').toUpperCase();
          if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
            value = `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
          } else if (/^\d{5}(-\d{4})?$/.test(cleaned)) {
            value = cleaned.slice(0, 5);
          } else {
            value = cleaned;
          }
          setFieldValue(order, fieldPath, value);
        }
      }

      if (mapping.removeIfNull) {
        const { isArray } = isArrayPath(order, fieldPath);
        if (isArray) {
          processArrayRemoveIfNull(order, mapping);
        } else {
          const currentValue = getFieldValue(order, fieldPath);
          if (currentValue === null || currentValue === undefined || currentValue === '' || currentValue === 'null') {
            deleteFieldValue(order, fieldPath);
            console.log(`[FieldMappingProcessor] Removed ${fieldPath} due to removeIfNull`);
          }
        }
      }
    }

    cleanupEmptyArrayItems(order);
  }

  console.log('[FieldMappingProcessor] Post-processing complete');
  return data;
}
