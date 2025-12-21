import { FunctionCondition, FieldMappingFunction, DateFunctionLogic, ConditionalFunctionLogic, AddressLookupFunctionLogic } from '../types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';

export function getFieldValue(fieldPath: string, data: Record<string, any>): any {
  if (!fieldPath || !data) return undefined;

  const parts = fieldPath.split('.');
  let value: any = data;

  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[part];
  }

  return value;
}

function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM-DD-YYYY':
      return `${month}-${day}-${year}`;
    case 'YYYY-MM-DDTHH:mm:ss':
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

function isDateFunctionLogic(logic: any): logic is DateFunctionLogic {
  return logic && logic.type === 'date';
}

function isAddressLookupFunctionLogic(logic: any): logic is AddressLookupFunctionLogic {
  return logic && logic.type === 'address_lookup';
}

export function evaluateDateFunction(logic: DateFunctionLogic, data: Record<string, any>): string {
  let baseDate: Date;

  if (logic.source === 'current_date') {
    baseDate = new Date();
  } else {
    const fieldValue = logic.fieldName ? getFieldValue(logic.fieldName, data) : null;
    if (!fieldValue) {
      return '';
    }
    baseDate = new Date(fieldValue);
    if (isNaN(baseDate.getTime())) {
      return '';
    }
  }

  const days = logic.days || 0;
  if (logic.operation === 'subtract') {
    baseDate.setDate(baseDate.getDate() - days);
  } else {
    baseDate.setDate(baseDate.getDate() + days);
  }

  return formatDate(baseDate, logic.outputFormat);
}

export function evaluateCondition(condition: FunctionCondition['if'], data: Record<string, any>): boolean {
  const { field, operator, value: expectedValue } = condition;
  const actualValue = getFieldValue(field, data);

  switch (operator) {
    case 'equals':
      return actualValue === expectedValue;

    case 'not_equals':
      return actualValue !== expectedValue;

    case 'in':
      if (!Array.isArray(expectedValue)) return false;
      return expectedValue.includes(actualValue);

    case 'not_in':
      if (!Array.isArray(expectedValue)) return true;
      return !expectedValue.includes(actualValue);

    case 'greater_than':
      return Number(actualValue) > Number(expectedValue);

    case 'less_than':
      return Number(actualValue) < Number(expectedValue);

    case 'contains':
      if (typeof actualValue !== 'string') return false;
      return actualValue.includes(String(expectedValue));

    case 'starts_with':
      if (typeof actualValue !== 'string') return false;
      return actualValue.startsWith(String(expectedValue));

    case 'ends_with':
      if (typeof actualValue !== 'string') return false;
      return actualValue.endsWith(String(expectedValue));

    case 'is_empty':
      return actualValue === null || actualValue === undefined || actualValue === '' ||
             (Array.isArray(actualValue) && actualValue.length === 0);

    case 'is_not_empty':
      return actualValue !== null && actualValue !== undefined && actualValue !== '' &&
             (!Array.isArray(actualValue) || actualValue.length > 0);

    default:
      return false;
  }
}

export function evaluateFunction(functionLogic: FieldMappingFunction['function_logic'], data: Record<string, any>): any {
  if (!functionLogic) {
    return undefined;
  }

  if (isDateFunctionLogic(functionLogic)) {
    return evaluateDateFunction(functionLogic, data);
  }

  if (isAddressLookupFunctionLogic(functionLogic)) {
    return '';
  }

  const conditionalLogic = functionLogic as ConditionalFunctionLogic;

  if (!conditionalLogic.conditions) {
    return conditionalLogic.default;
  }

  for (const condition of conditionalLogic.conditions) {
    if (!evaluateCondition(condition.if, data)) {
      continue;
    }

    if (condition.additionalConditions?.length) {
      const allAdditionalPass = condition.additionalConditions.every(
        addCond => evaluateCondition(addCond, data)
      );
      if (!allAdditionalPass) {
        continue;
      }
    }

    return condition.then;
  }

  return conditionalLogic.default;
}

async function getApiKey(): Promise<string> {
  const { data: activeKey } = await supabase
    .from('gemini_api_keys')
    .select('api_key')
    .eq('is_active', true)
    .maybeSingle();

  if (!activeKey?.api_key) {
    throw new Error('Google API key not configured');
  }

  return activeKey.api_key;
}

export async function evaluateAddressLookup(logic: AddressLookupFunctionLogic, data: Record<string, any>): Promise<string> {
  const { inputFields, lookupType, countryContext } = logic;
  console.log(`[AddressLookup] Starting lookup: type=${lookupType}, inputFields=${JSON.stringify(inputFields)}`);

  const addressParts: string[] = [];
  for (const field of inputFields) {
    const value = getFieldValue(field, data);
    console.log(`[AddressLookup] Field "${field}" = "${value}"`);
    if (value && typeof value === 'string' && value.trim()) {
      addressParts.push(value.trim());
    }
  }

  if (addressParts.length === 0) {
    console.log(`[AddressLookup] No address parts found, returning empty`);
    return '';
  }

  const addressString = addressParts.join(', ');
  console.log(`[AddressLookup] Address string: "${addressString}"`);

  const lookupTypeLabels: Record<string, string> = {
    'postal_code': 'postal code or ZIP code',
    'city': 'city name',
    'province': 'province or state (2-letter code)',
    'country': 'country name',
    'full_address': 'complete formatted address'
  };

  const lookupLabel = lookupTypeLabels[lookupType] || lookupType;
  const countryHint = countryContext ? ` The address is in ${countryContext}.` : '';

  const prompt = `Given this address information: "${addressString}"${countryHint}

Return ONLY the ${lookupLabel}, nothing else. No explanations, no formatting, just the value.

${lookupType === 'postal_code' ? 'For Canadian addresses, format as "A1A 1A1" (with space). For US addresses, use 5-digit format "12345".' : ''}
${lookupType === 'province' ? 'Return only the 2-letter province/state code (e.g., "ON", "BC", "CA", "NY").' : ''}

If you cannot determine the ${lookupLabel} from the given information, return an empty response.`;

  try {
    console.log(`[AddressLookup] Fetching API key...`);
    const apiKey = await getApiKey();
    console.log(`[AddressLookup] API key obtained, calling Gemini...`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    console.log(`[AddressLookup] Gemini response: "${text}"`);

    return text || '';
  } catch (error) {
    console.error('[AddressLookup] Failed:', error);
    return '';
  }
}
