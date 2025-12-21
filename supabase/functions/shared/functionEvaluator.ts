export type FunctionOperator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | 'less_than'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty';

export interface FunctionConditionClause {
  field: string;
  operator: FunctionOperator;
  value: any;
}

export interface FunctionCondition {
  if: FunctionConditionClause;
  additionalConditions?: FunctionConditionClause[];
  then: any;
}

export interface ConditionalFunctionLogic {
  conditions: FunctionCondition[];
  default?: any;
}

export interface DateFunctionLogic {
  type: 'date';
  source: 'field' | 'current_date';
  fieldName?: string;
  operation: 'add' | 'subtract';
  days: number;
  outputFormat?: string;
}

export interface AddressLookupFunctionLogic {
  type: 'address_lookup';
  inputFields: string[];
  lookupType: 'postal_code' | 'city' | 'province' | 'country' | 'full_address';
  countryContext?: string;
}

export type FunctionLogic = ConditionalFunctionLogic | DateFunctionLogic | AddressLookupFunctionLogic;

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

export function evaluateFunction(functionLogic: FunctionLogic, data: Record<string, any>): any {
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

export async function evaluateAddressLookupAsync(
  logic: AddressLookupFunctionLogic,
  data: Record<string, any>,
  apiKey: string
): Promise<string> {
  const { inputFields, lookupType, countryContext } = logic;

  const addressParts: string[] = [];
  for (const field of inputFields) {
    const value = getFieldValue(field, data);
    if (value && typeof value === 'string' && value.trim()) {
      addressParts.push(value.trim());
    }
  }

  if (addressParts.length === 0) {
    return '';
  }

  const addressString = addressParts.join(', ');

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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return text;
  } catch (error) {
    console.error('Address lookup failed:', error);
    return '';
  }
}
