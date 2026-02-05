import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getValueByPath(obj: any, path: string): any {
  try {
    let actualPath = path;
    if (path.startsWith('execute.')) {
      actualPath = path.substring('execute.'.length);
    }

    const parts = actualPath.split('.');
    let current = obj;

    for (const part of parts) {
      if (part.includes('[') && part.includes(']')) {
        const arrayName = part.substring(0, part.indexOf('['));
        const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')));
        current = current[arrayName]?.[arrayIndex];
      } else if (!isNaN(Number(part))) {
        current = current?.[parseInt(part)];
      } else {
        current = current?.[part];
      }

      if (current === undefined || current === null) {
        return null;
      }
    }

    return current;
  } catch {
    return null;
  }
}

function replaceVariables(template: string, contextData: any): string {
  if (!template || typeof template !== 'string') return template;

  const variableRegex = /\{\{([^}]+)\}\}/g;
  return template.replace(variableRegex, (match, path) => {
    const trimmedPath = path.trim();

    let value = getValueByPath(contextData.execute, trimmedPath);
    if (value === null || value === undefined) {
      value = getValueByPath(contextData.response, trimmedPath);
    }
    if (value === null || value === undefined) {
      value = getValueByPath(contextData, trimmedPath);
    }

    if (value !== null && value !== undefined) {
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    }
    return match;
  });
}

function setValueByPath(obj: any, path: string, value: any): void {
  const parts: Array<{ key: string; isArray: boolean; index?: number }> = [];
  const pathParts = path.split('.');

  for (const part of pathParts) {
    const arrayMatch = part.match(/^(.+?)\[(\d+)\]$/);
    if (arrayMatch) {
      parts.push({ key: arrayMatch[1], isArray: true, index: parseInt(arrayMatch[2]) });
    } else {
      parts.push({ key: part, isArray: false });
    }
  }

  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];

    if (part.isArray) {
      if (!current[part.key]) {
        current[part.key] = [];
      }
      if (!current[part.key][part.index!]) {
        current[part.key][part.index!] = nextPart.isArray ? [] : {};
      }
      current = current[part.key][part.index!];
    } else {
      if (!current[part.key]) {
        current[part.key] = nextPart.isArray ? [] : {};
      }
      current = current[part.key];
    }
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart.isArray) {
    if (!current[lastPart.key]) {
      current[lastPart.key] = [];
    }
    current[lastPart.key][lastPart.index!] = value;
  } else {
    current[lastPart.key] = value;
  }
}

async function executeApiCall(step: any, contextData: any): Promise<any> {
  console.log('\uD83C\uDF10 Executing API Call step:', step.step_name);
  const config = step.config_json || {};

  let url = replaceVariables(config.url || '', contextData);
  console.log('\uD83D\uDD17 URL:', url);

  let requestBody = replaceVariables(config.requestBody || '', contextData);
  console.log('\uD83D\uDCC4 Request body:', requestBody);

  const fetchOptions: RequestInit = {
    method: config.method || 'POST',
    headers: config.headers || { 'Content-Type': 'application/json' }
  };

  if (config.method?.toUpperCase() !== 'GET' && requestBody?.trim()) {
    fetchOptions.body = requestBody;
  }

  const response = await fetch(url, fetchOptions);
  console.log('\uD83D\uDCCA Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed with status ${response.status}: ${errorText}`);
  }

  const responseText = await response.text();
  let responseData = null;

  try {
    if (responseText?.trim()) {
      responseData = JSON.parse(responseText);
    }
  } catch {
    responseData = { rawResponse: responseText };
  }

  if (config.responseDataMappings && Array.isArray(config.responseDataMappings)) {
    if (!contextData.response) {
      contextData.response = {};
    }
    for (const mapping of config.responseDataMappings) {
      if (mapping.responsePath && mapping.updatePath) {
        const extractedValue = getValueByPath(responseData, mapping.responsePath);
        if (extractedValue !== null && extractedValue !== undefined) {
          const pathParts = mapping.updatePath.split('.');
          let current = contextData.response;
          for (let i = 0; i < pathParts.length - 1; i++) {
            if (!current[pathParts[i]]) current[pathParts[i]] = {};
            current = current[pathParts[i]];
          }
          current[pathParts[pathParts.length - 1]] = extractedValue;
          console.log(`\uD83D\uDCDD Stored response.${mapping.updatePath} =`, extractedValue);
        }
      }
    }
  }

  return responseData;
}

async function executeApiEndpointSingle(
  config: any,
  contextData: any,
  baseUrl: string,
  authToken: string,
  rowData?: any
): Promise<any> {
  const effectiveContext = rowData ? { ...contextData, execute: { ...contextData.execute, ...rowData } } : contextData;

  let apiPath = replaceVariables(config.apiPath || '', effectiveContext);

  const pathVariableConfig = config.pathVariableConfig || {};
  for (const [varName, varConfig] of Object.entries(pathVariableConfig)) {
    const isEnabled = typeof varConfig === 'string' ? true : ((varConfig as any).enabled ?? true);
    const valueTemplate = typeof varConfig === 'string' ? varConfig : ((varConfig as any).value || '');

    if (isEnabled && valueTemplate) {
      const resolvedValue = replaceVariables(valueTemplate, effectiveContext);
      apiPath = apiPath.replace(`{${varName}}`, resolvedValue);
      apiPath = apiPath.replace(`\${${varName}}`, resolvedValue);
    }
  }

  const queryParameterConfig = config.queryParameterConfig || {};
  const queryParts: string[] = [];

  for (const [paramName, paramConfig] of Object.entries(queryParameterConfig)) {
    const cfg = paramConfig as any;
    if (cfg.enabled && cfg.value) {
      const paramValue = replaceVariables(cfg.value, effectiveContext);
      const odataParams = ['$filter', '$select', '$orderby', '$expand', '$top', '$skip', '$count'];
      const isOData = odataParams.some(p => p.toLowerCase() === paramName.toLowerCase());

      if (isOData) {
        queryParts.push(`${paramName}=${paramValue.replace(/ /g, '%20')}`);
      } else {
        queryParts.push(`${encodeURIComponent(paramName)}=${encodeURIComponent(paramValue)}`);
      }
    }
  }

  const queryString = queryParts.join('&');
  const fullUrl = `${baseUrl}${apiPath}${queryString ? '?' + queryString : ''}`;
  console.log('\uD83D\uDD17 Full URL:', fullUrl);

  const fieldMappings = config.requestBodyFieldMappings || [];
  let requestBodyContent = '';

  if (fieldMappings.length > 0) {
    try {
      const requestBodyData: any = {};

      for (const mapping of fieldMappings) {
        let finalValue;
        if (mapping.type === 'hardcoded') {
          finalValue = mapping.value;
        } else if (mapping.type === 'variable') {
          const variableName = mapping.value.replace(/^\{\{|\}\}$/g, '');
          finalValue = getValueByPath(effectiveContext.execute, variableName) ?? getValueByPath(effectiveContext, variableName);
        }

        if (finalValue !== undefined && finalValue !== null) {
          if (mapping.dataType === 'integer') finalValue = parseInt(String(finalValue));
          else if (mapping.dataType === 'number') finalValue = parseFloat(String(finalValue));
          else if (mapping.dataType === 'boolean') finalValue = String(finalValue).toLowerCase() === 'true' ? 'True' : 'False';
          else finalValue = String(finalValue);

          setValueByPath(requestBodyData, mapping.fieldName, finalValue);
        }
      }

      requestBodyContent = JSON.stringify(requestBodyData);
    } catch (e) {
      console.error('Error processing field mappings:', e);
    }
  } else if (config.requestBodyTemplate) {
    requestBodyContent = replaceVariables(config.requestBodyTemplate, effectiveContext);
  }

  if (config.wrapBodyInArray && requestBodyContent?.trim()) {
    try {
      const parsedBody = JSON.parse(requestBodyContent);
      if (!Array.isArray(parsedBody)) {
        requestBodyContent = JSON.stringify([parsedBody]);
        console.log('Wrapped request body in array:', requestBodyContent);
      }
    } catch (e) {
      console.warn('Could not wrap body in array - invalid JSON:', e);
    }
  }

  const httpMethod = config.httpMethod || 'GET';
  const fetchOptions: RequestInit = {
    method: httpMethod,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };

  if (httpMethod.toUpperCase() !== 'GET' && requestBodyContent?.trim()) {
    fetchOptions.body = requestBodyContent;
  }

  const response = await fetch(fullUrl, fetchOptions);
  console.log('\uD83D\uDCCA Response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`API endpoint call failed with status ${response.status}: ${errorText}`);
    (error as any).requestUrl = fullUrl;
    (error as any).requestBody = requestBodyContent || null;
    (error as any).httpMethod = httpMethod;
    throw error;
  }

  const responseText = await response.text();
  let responseData = null;

  try {
    if (responseText?.trim()) {
      responseData = JSON.parse(responseText);
    } else {
      responseData = { success: true };
    }
  } catch {
    responseData = { rawResponse: responseText };
  }

  return responseData;
}

async function executeApiEndpoint(step: any, contextData: any, supabaseUrl: string, supabaseServiceKey: string): Promise<any> {
  console.log('\uD83C\uDF10 Executing API Endpoint step:', step.step_name);
  const config = step.config_json || {};

  let baseUrl = '';
  let authToken = '';
  const apiSourceType = config.apiSourceType || 'main';

  if (apiSourceType === 'main') {
    const response = await fetch(`${supabaseUrl}/rest/v1/api_settings?select=*`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    });
    if (response.ok) {
      const apis = await response.json();
      if (apis?.[0]) {
        baseUrl = apis[0].path || '';
        authToken = apis[0].password || '';
      }
    }
  } else if (apiSourceType === 'secondary' && config.secondaryApiId) {
    const response = await fetch(`${supabaseUrl}/rest/v1/secondary_api_configs?select=*&id=eq.${config.secondaryApiId}`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    });
    if (response.ok) {
      const apis = await response.json();
      if (apis?.[0]) {
        baseUrl = apis[0].base_url || '';
        authToken = apis[0].auth_token || '';
      }
    }
  }

  if (!baseUrl) {
    throw new Error('API base URL not configured');
  }

  const arrayProcessingMode = config.arrayProcessingMode || 'none';
  const arraySourceGroupId = config.arraySourceGroupId;
  const stopOnError = config.stopOnError !== false;

  if (arrayProcessingMode === 'single_array') {
    console.log(`\uD83D\uDCE6 Single Array mode: wrapping body in array without group iteration`);

    const adjustedFieldMappings = (config.requestBodyFieldMappings || []).map((mapping: any) => {
      const fieldName = mapping.fieldName || '';
      const strippedFieldName = fieldName.replace(/^\d+\./, '');
      return { ...mapping, fieldName: strippedFieldName };
    });

    const singleArrayConfig = {
      ...config,
      wrapBodyInArray: true,
      requestBodyFieldMappings: adjustedFieldMappings
    };

    const responseData = await executeApiEndpointSingle(singleArrayConfig, contextData, baseUrl, authToken);
    applyResponseMappings(config, responseData, contextData);
    return responseData;
  }

  if (arrayProcessingMode === 'conditional_hardcode') {
    console.log(`\uD83D\uDD00 Conditional Hardcode mode: evaluating conditions`);
    const conditionalMappings = config.conditionalArrayMappings || [];
    const matchingMappings: any[] = [];

    console.log(`\uD83D\uDCCB === CONDITIONAL DEBUG START ===`);
    console.log(`\uD83D\uDCE6 Full contextData.execute:`, JSON.stringify(contextData.execute, null, 2));
    console.log(`\uD83D\uDCCA Total conditions to evaluate: ${conditionalMappings.length}`);
    console.log(`\uD83D\uDCCB Raw conditionalMappings from config:`, JSON.stringify(conditionalMappings, null, 2));

    for (let conditionIndex = 0; conditionIndex < conditionalMappings.length; conditionIndex++) {
      const condition = conditionalMappings[conditionIndex];
      console.log(`\n\uD83D\uDD0D === Evaluating Condition ${conditionIndex + 1} ===`);
      console.log(`\uD83D\uDCCB Condition object:`, JSON.stringify(condition, null, 2));

      const variablePath = condition.variable || '';
      console.log(`\uD83D\uDCCD Variable path (raw): "${variablePath}"`);

      let actualValue = getValueByPath(contextData.execute, variablePath);
      console.log(`\uD83D\uDD0D Value from contextData.execute: "${actualValue}" (type: ${typeof actualValue})`);

      if (actualValue === null || actualValue === undefined) {
        actualValue = getValueByPath(contextData, variablePath);
        console.log(`\uD83D\uDD0D Value from contextData (fallback): "${actualValue}" (type: ${typeof actualValue})`);
      }

      const expectedValue = condition.expectedValue;
      const operator = condition.operator || 'equals';
      console.log(`\uD83C\uDFAF Expected value: "${expectedValue}" (type: ${typeof expectedValue})`);
      console.log(`\u2696\uFE0F Operator: "${operator}"`);

      let conditionMet = false;

      const actualLower = String(actualValue).toLowerCase();
      const expectedLower = String(expectedValue).toLowerCase();
      console.log(`\uD83D\uDD04 Comparison values - actualLower: "${actualLower}", expectedLower: "${expectedLower}"`);

      switch (operator) {
        case 'equals':
          conditionMet = actualLower === expectedLower;
          console.log(`\uD83D\uDCDD Equals check: "${actualLower}" === "${expectedLower}" = ${conditionMet}`);
          break;
        case 'not_equals':
          conditionMet = actualLower !== expectedLower;
          console.log(`\uD83D\uDCDD Not equals check: "${actualLower}" !== "${expectedLower}" = ${conditionMet}`);
          break;
        case 'contains':
          conditionMet = String(actualValue).includes(String(expectedValue));
          console.log(`\uD83D\uDCDD Contains check: "${actualValue}".includes("${expectedValue}") = ${conditionMet}`);
          break;
        case 'not_contains':
          conditionMet = !String(actualValue).includes(String(expectedValue));
          console.log(`\uD83D\uDCDD Not contains check: !"${actualValue}".includes("${expectedValue}") = ${conditionMet}`);
          break;
        default:
          conditionMet = String(actualValue) === String(expectedValue);
          console.log(`\uD83D\uDCDD Default check: "${actualValue}" === "${expectedValue}" = ${conditionMet}`);
      }

      console.log(`\u2705 Condition ${conditionIndex + 1} RESULT: ${conditionMet ? 'MATCHED' : 'NOT MATCHED'}`);

      if (conditionMet) {
        console.log(`\uD83D\uDCE5 Adding field mappings from Condition ${conditionIndex + 1} to matchingMappings`);
        console.log(`\uD83D\uDCCB Field mappings being added:`, JSON.stringify(condition.fieldMappings, null, 2));
        matchingMappings.push(condition.fieldMappings);
      }
    }

    console.log(`\n\uD83D\uDCCB === CONDITIONAL DEBUG END ===`);
    console.log(`\u2705 ${matchingMappings.length} conditions matched out of ${conditionalMappings.length}`);

    if (matchingMappings.length === 0) {
      console.log('\u26A0\uFE0F No conditions matched, skipping API call');
      return {
        arrayProcessingMode: 'conditional_hardcode',
        totalConditions: conditionalMappings.length,
        matchedConditions: 0,
        skipped: true,
        message: 'No conditions matched'
      };
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < matchingMappings.length; i++) {
      const fieldMappings = matchingMappings[i];
      console.log(`\uD83D\uDD04 Processing matched condition ${i + 1}/${matchingMappings.length}`);

      try {
        const conditionalConfig = {
          ...config,
          wrapBodyInArray: true,
          requestBodyFieldMappings: fieldMappings
        };

        const responseData = await executeApiEndpointSingle(conditionalConfig, contextData, baseUrl, authToken);
        results.push({ index: i, success: true, data: responseData });

        if (i === 0) {
          applyResponseMappings(config, responseData, contextData);
        }
      } catch (error) {
        console.error(`\u274C Conditional mapping ${i + 1} failed:`, error);
        errors.push({ index: i, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return {
      arrayProcessingMode: 'conditional_hardcode',
      totalConditions: conditionalMappings.length,
      matchedConditions: matchingMappings.length,
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  if (arrayProcessingMode !== 'none' && arraySourceGroupId) {
    const groupResponse = await fetch(`${supabaseUrl}/rest/v1/execute_button_groups?id=eq.${arraySourceGroupId}`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    });

    let arrayFieldName = '';
    if (groupResponse.ok) {
      const groups = await groupResponse.json();
      if (groups?.[0]) {
        arrayFieldName = groups[0].array_field_name || groups[0].name;
      }
    }

    const arrayData = contextData.execute?.[arrayFieldName] || [];
    console.log(`\uD83D\uDD04 Array processing mode: ${arrayProcessingMode}, field: ${arrayFieldName}, rows: ${arrayData.length}`);

    if (!Array.isArray(arrayData) || arrayData.length === 0) {
      console.log('\u26A0\uFE0F No array data found, executing single request');
      const responseData = await executeApiEndpointSingle(config, contextData, baseUrl, authToken);
      applyResponseMappings(config, responseData, contextData);
      return responseData;
    }

    if (arrayProcessingMode === 'loop') {
      console.log(`\uD83D\uDD01 Loop mode: executing ${arrayData.length} API calls`);
      const results: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < arrayData.length; i++) {
        const rowData = arrayData[i];
        console.log(`\uD83D\uDD04 Processing row ${i + 1}/${arrayData.length}`);

        try {
          const responseData = await executeApiEndpointSingle(config, contextData, baseUrl, authToken, rowData);
          results.push({ index: i, success: true, data: responseData });

          if (i === 0) {
            applyResponseMappings(config, responseData, contextData);
          }
        } catch (error) {
          console.error(`\u274C Row ${i + 1} failed:`, error);
          errors.push({ index: i, error: error instanceof Error ? error.message : 'Unknown error' });

          if (stopOnError) {
            throw new Error(`Array loop failed at row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      return {
        arrayProcessingMode: 'loop',
        totalRows: arrayData.length,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined
      };
    } else if (arrayProcessingMode === 'batch') {
      console.log(`\uD83D\uDCE6 Batch mode: sending ${arrayData.length} rows in single request`);

      const batchContextData = {
        ...contextData,
        arrayData
      };

      const responseData = await executeApiEndpointSingle(config, batchContextData, baseUrl, authToken);
      applyResponseMappings(config, responseData, contextData);

      return {
        arrayProcessingMode: 'batch',
        totalRows: arrayData.length,
        response: responseData
      };
    }
  }

  const responseData = await executeApiEndpointSingle(config, contextData, baseUrl, authToken);
  applyResponseMappings(config, responseData, contextData);
  return responseData;
}

function applyResponseMappings(config: any, responseData: any, contextData: any): void {
  const responseDataMappings = config.responseDataMappings || [];
  if (!contextData.response) {
    contextData.response = {};
  }
  for (const mapping of responseDataMappings) {
    if (mapping.responsePath && mapping.updatePath) {
      const extractedValue = getValueByPath(responseData, mapping.responsePath);
      if (extractedValue !== null && extractedValue !== undefined) {
        const pathParts = mapping.updatePath.split('.');
        let current = contextData.response;
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!current[pathParts[i]]) current[pathParts[i]] = {};
          current = current[pathParts[i]];
        }
        current[pathParts[pathParts.length - 1]] = extractedValue;
        console.log(`\uD83D\uDCDD Stored response.${mapping.updatePath} =`, extractedValue);
      }
    }
  }
}

function evaluateSingleCondition(
  fieldPath: string,
  operator: string,
  expectedValue: any,
  contextData: any
): { conditionMet: boolean; actualValue: any } {
  const cleanFieldPath = fieldPath.replace(/^\{\{|\}\}$/g, '');

  let actualValue = getValueByPath(contextData.execute, cleanFieldPath);
  if (actualValue === null || actualValue === undefined) {
    actualValue = getValueByPath(contextData, cleanFieldPath);
  }

  let conditionMet = false;

  switch (operator) {
    case 'exists':
      conditionMet = actualValue !== null && actualValue !== undefined && actualValue !== '';
      break;
    case 'not_exists':
    case 'notExists':
      conditionMet = actualValue === null || actualValue === undefined || actualValue === '';
      break;
    case 'is_null':
    case 'isNull':
      conditionMet = actualValue === null || actualValue === undefined;
      break;
    case 'is_not_null':
    case 'isNotNull':
      conditionMet = actualValue !== null && actualValue !== undefined;
      break;
    case 'equals':
    case 'eq':
      conditionMet = String(actualValue).toLowerCase() === String(expectedValue).toLowerCase();
      break;
    case 'not_equals':
    case 'notEquals':
    case 'ne':
      conditionMet = String(actualValue).toLowerCase() !== String(expectedValue).toLowerCase();
      break;
    case 'contains':
      conditionMet = String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      break;
    case 'not_contains':
    case 'notContains':
      conditionMet = !String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      break;
    case 'greater_than':
    case 'gt':
      conditionMet = parseFloat(actualValue) > parseFloat(expectedValue);
      break;
    case 'less_than':
    case 'lt':
      conditionMet = parseFloat(actualValue) < parseFloat(expectedValue);
      break;
    default:
      conditionMet = actualValue !== null && actualValue !== undefined && actualValue !== '';
  }

  return { conditionMet, actualValue };
}

async function executeConditionalCheck(step: any, contextData: any): Promise<any> {
  console.log('\uD83D\uDD0D Executing Conditional Check step:', step.step_name);
  const config = step.config_json || {};

  const rawFieldPath = config.fieldPath || config.jsonPath || config.checkField || '';
  const operator = config.operator || config.conditionType || 'exists';
  const expectedValue = config.expectedValue;
  const additionalConditions = config.additionalConditions || [];
  const logicalOperator = config.logicalOperator || 'AND';

  const primaryResult = evaluateSingleCondition(rawFieldPath, operator, expectedValue, contextData);
  console.log(`\uD83D\uDD0D Primary condition: ${rawFieldPath} ${operator} ${expectedValue} = ${primaryResult.conditionMet} (actual: ${primaryResult.actualValue})`);

  let conditionMet = primaryResult.conditionMet;

  if (additionalConditions.length > 0) {
    console.log(`\uD83D\uDD17 Evaluating ${additionalConditions.length} additional condition(s) with ${logicalOperator} logic`);

    const allResults: boolean[] = [primaryResult.conditionMet];

    for (let i = 0; i < additionalConditions.length; i++) {
      const cond = additionalConditions[i];
      if (!cond.jsonPath) continue;

      const result = evaluateSingleCondition(
        cond.jsonPath,
        cond.operator || 'equals',
        cond.expectedValue,
        contextData
      );
      console.log(`\uD83D\uDD0D Additional condition ${i + 1}: ${cond.jsonPath} ${cond.operator} ${cond.expectedValue} = ${result.conditionMet} (actual: ${result.actualValue})`);
      allResults.push(result.conditionMet);
    }

    if (logicalOperator === 'AND') {
      conditionMet = allResults.every(r => r === true);
      console.log(`\u2705 AND result: ${conditionMet} (all ${allResults.length} conditions must be true)`);
    } else {
      conditionMet = allResults.some(r => r === true);
      console.log(`\u2705 OR result: ${conditionMet} (at least one of ${allResults.length} conditions must be true)`);
    }
  }

  const storeResultAs = config.storeResultAs || `condition_${step.step_order}_result`;
  contextData[storeResultAs] = conditionMet;

  return {
    conditionMet,
    fieldPath: rawFieldPath,
    operator,
    actualValue: primaryResult.actualValue,
    expectedValue,
    additionalConditions: additionalConditions.length,
    logicalOperator: additionalConditions.length > 0 ? logicalOperator : undefined
  };
}

async function executeAiLookup(step: any, contextData: any, supabaseUrl: string, supabaseServiceKey: string): Promise<any> {
  console.log('\uD83E\uDD16 Executing AI Lookup step:', step.step_name);
  const config = step.config_json || {};

  const apiKeyResponse = await fetch(`${supabaseUrl}/rest/v1/gemini_api_keys?is_active=eq.true&limit=1`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey
    }
  });

  if (!apiKeyResponse.ok) {
    throw new Error('Failed to fetch Gemini API key configuration');
  }

  const apiKeys = await apiKeyResponse.json();
  if (!apiKeys?.length) {
    throw new Error('No active Gemini API key found. Please configure Gemini API in Settings > API Settings > Gemini AI.');
  }

  const activeApiKey = apiKeys[0];
  const apiKey = activeApiKey.api_key;

  const modelResponse = await fetch(`${supabaseUrl}/rest/v1/gemini_models?is_active=eq.true&limit=1`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey
    }
  });

  if (!modelResponse.ok) {
    throw new Error('Failed to fetch Gemini model configuration');
  }

  const models = await modelResponse.json();
  const modelName = models?.[0]?.model_name || 'gemini-1.5-flash';

  const basePrompt = replaceVariables(config.aiPrompt || '', contextData);
  const responseMappings = config.aiResponseMappings || [];

  const fieldInstructions = responseMappings.map((m: any) =>
    `- "${m.fieldName}": ${m.aiInstruction}`
  ).join('\n');

  const fullPrompt = `${basePrompt}

You must respond with a valid JSON object containing the following fields:
${fieldInstructions}

IMPORTANT:
- Return ONLY a valid JSON object, no markdown or other formatting
- If you cannot find information for a field, use null
- Keep values concise and accurate`;

  console.log('\uD83D\uDCDD AI Prompt:', fullPrompt);

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        }
      })
    }
  );

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    throw new Error(`Gemini API call failed: ${errorText}`);
  }

  const geminiData = await geminiResponse.json();
  const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('\uD83E\uDD16 AI Response:', responseText);

  let aiResults: Record<string, any> = {};
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    aiResults = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse AI response as JSON:', parseError);
    for (const mapping of responseMappings) {
      const regex = new RegExp(`"${mapping.fieldName}"\\s*:\\s*"([^"]*)"`, 'i');
      const match = responseText.match(regex);
      if (match) {
        aiResults[mapping.fieldName] = match[1];
      }
    }
  }

  if (!contextData.execute) {
    contextData.execute = {};
  }
  if (!contextData.execute.ai) {
    contextData.execute.ai = {};
  }

  for (const [key, value] of Object.entries(aiResults)) {
    contextData.execute.ai[key] = value;
  }

  console.log('\u2705 AI Lookup results stored in execute.ai:', aiResults);

  return {
    success: true,
    results: aiResults,
    rawResponse: responseText
  };
}

async function executeGooglePlacesLookup(step: any, contextData: any, supabaseUrl: string, supabaseServiceKey: string): Promise<any> {
  console.log('\uD83D\uDCCD Executing Google Places Lookup step:', step.step_name);
  const config = step.config_json || {};

  const apiKeyResponse = await fetch(`${supabaseUrl}/rest/v1/api_settings?select=google_places_api_key&limit=1`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey
    }
  });

  if (!apiKeyResponse.ok) {
    throw new Error('Failed to fetch Google Places API key configuration');
  }

  const apiSettings = await apiKeyResponse.json();
  if (!apiSettings?.length || !apiSettings[0].google_places_api_key) {
    throw new Error('Google Places API key not configured. Please configure it in Settings > API Settings > Google Places.');
  }

  const apiKey = apiSettings[0].google_places_api_key;
  const searchQuery = replaceVariables(config.placesSearchQuery || '', contextData);

  if (!searchQuery.trim()) {
    throw new Error('Search query is empty after variable substitution');
  }

  console.log('\uD83D\uDD0D Search query:', searchQuery);

  const fieldsToReturn = config.placesFieldsToReturn || { name: true, address: true };
  const fieldMask: string[] = ['places.id'];

  if (fieldsToReturn.name) fieldMask.push('places.displayName');
  if (fieldsToReturn.address) fieldMask.push('places.formattedAddress', 'places.addressComponents');
  if (fieldsToReturn.phone) fieldMask.push('places.nationalPhoneNumber', 'places.internationalPhoneNumber');
  if (fieldsToReturn.website) fieldMask.push('places.websiteUri');
  if (fieldsToReturn.rating) fieldMask.push('places.rating', 'places.userRatingCount');
  if (fieldsToReturn.hours) fieldMask.push('places.currentOpeningHours');
  if (fieldsToReturn.placeId) fieldMask.push('places.id');
  fieldMask.push('places.location');

  const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask.join(',')
    },
    body: JSON.stringify({
      textQuery: searchQuery
    })
  });

  if (!placesResponse.ok) {
    const errorText = await placesResponse.text();
    throw new Error(`Google Places API call failed: ${errorText}`);
  }

  const placesData = await placesResponse.json();
  console.log('\uD83D\uDCCD Places response:', JSON.stringify(placesData));

  if (!placesData.places || placesData.places.length === 0) {
    console.log('\u26A0\uFE0F No places found for query');
    return {
      success: false,
      message: 'No places found for the given query',
      query: searchQuery
    };
  }

  const place = placesData.places[0];
  const extractedData: Record<string, any> = {};

  extractedData.name = place.displayName?.text || place.displayName || null;
  extractedData.formattedAddress = place.formattedAddress || null;
  extractedData.placeId = place.id || null;

  if (place.addressComponents) {
    for (const component of place.addressComponents) {
      const types = component.types || [];
      if (types.includes('street_number') || types.includes('route')) {
        const streetNum = place.addressComponents.find((c: any) => c.types?.includes('street_number'))?.longText || '';
        const route = place.addressComponents.find((c: any) => c.types?.includes('route'))?.longText || '';
        extractedData.streetAddress = `${streetNum} ${route}`.trim();
      }
      if (types.includes('locality')) {
        extractedData.city = component.longText || null;
      }
      if (types.includes('administrative_area_level_1')) {
        extractedData.state = component.shortText || null;
      }
      if (types.includes('postal_code')) {
        extractedData.postalCode = component.longText || null;
      }
      if (types.includes('country')) {
        extractedData.country = component.longText || null;
      }
    }
  }

  extractedData.phone = place.nationalPhoneNumber || place.internationalPhoneNumber || null;
  extractedData.website = place.websiteUri || null;
  extractedData.rating = place.rating || null;
  extractedData.userRatingsTotal = place.userRatingCount || null;

  if (place.currentOpeningHours?.weekdayDescriptions) {
    extractedData.hours = place.currentOpeningHours.weekdayDescriptions.join('; ');
  }

  if (place.location) {
    extractedData.latitude = place.location.latitude || null;
    extractedData.longitude = place.location.longitude || null;
  }

  if (!contextData.execute) {
    contextData.execute = {};
  }
  if (!contextData.execute.places) {
    contextData.execute.places = {};
  }

  const responseMappings = config.placesResponseMappings || [];
  for (const mapping of responseMappings) {
    if (mapping.fieldName && mapping.placesField) {
      const value = extractedData[mapping.placesField];
      contextData.execute.places[mapping.fieldName] = value;
      console.log(`\uD83D\uDCDD Stored execute.places.${mapping.fieldName} =`, value);
    }
  }

  console.log('\u2705 Google Places Lookup results stored in execute.places:', contextData.execute.places);

  return {
    success: true,
    results: contextData.execute.places,
    rawData: extractedData,
    query: searchQuery
  };
}

async function executeEmailAction(step: any, contextData: any, supabaseUrl: string, supabaseServiceKey: string): Promise<any> {
  console.log('\uD83D\uDCE7 Executing Email Action step:', step.step_name);
  const config = step.config_json || {};

  const to = replaceVariables(config.to || '', contextData);
  const subject = replaceVariables(config.subject || '', contextData);
  const body = replaceVariables(config.body || '', contextData);
  const from = config.from ? replaceVariables(config.from, contextData) : undefined;

  const emailConfigResponse = await fetch(`${supabaseUrl}/rest/v1/email_monitoring_config?limit=1`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey
    }
  });

  if (!emailConfigResponse.ok) {
    throw new Error('Email configuration not found');
  }

  const emailConfigs = await emailConfigResponse.json();
  if (!emailConfigs?.length) {
    throw new Error('Email configuration not found');
  }

  const emailConfig = emailConfigs[0];

  if (emailConfig.provider === 'office365') {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${emailConfig.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: emailConfig.client_id,
        client_secret: emailConfig.client_secret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Office365 access token');
    }

    const tokenData = await tokenResponse.json();
    const sendFrom = from || emailConfig.default_send_from_email;

    const emailPayload = {
      message: {
        subject,
        body: { contentType: 'HTML', content: body.replace(/\n/g, '<br>') },
        toRecipients: [{ emailAddress: { address: to } }]
      },
      saveToSentItems: true
    };

    const sendResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${sendFrom}/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    return { success: true, to, subject };
  }

  throw new Error(`Unsupported email provider: ${emailConfig.provider}`);
}

interface FlowNode {
  id: string;
  node_type: 'group' | 'workflow';
  label: string;
  group_id?: string;
  step_type?: string;
  config_json?: any;
}

interface FlowEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle?: string;
}

function buildExecutionOrder(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, FlowEdge[]>();

  for (const node of nodes) {
    incomingEdges.set(node.id, []);
    outgoingEdges.set(node.id, []);
  }

  for (const edge of edges) {
    incomingEdges.get(edge.target_node_id)?.push(edge.source_node_id);
    outgoingEdges.get(edge.source_node_id)?.push(edge);
  }

  const startNodes = nodes.filter(n => (incomingEdges.get(n.id) || []).length === 0);
  const executionOrder: FlowNode[] = [];
  const visited = new Set<string>();

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      executionOrder.push(node);
    }

    const outEdges = outgoingEdges.get(nodeId) || [];
    for (const edge of outEdges) {
      traverse(edge.target_node_id);
    }
  }

  for (const startNode of startNodes) {
    traverse(startNode.id);
  }

  return executionOrder;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  console.log('\uD83D\uDE80 === EXECUTE BUTTON PROCESSOR START ===');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const requestData = await req.json();
    const { buttonId, executeParameters, userId, flowNodeId, continueFromNode, userConfirmationResponse, pendingContextData, currentGroupNodeId, existingContextData } = requestData;

    console.log('\uD83D\uDCCB Button ID:', buttonId);
    console.log('\uD83D\uDC64 User ID:', userId);
    console.log('\uD83D\uDCCA Parameters:', JSON.stringify(executeParameters));
    console.log('\uD83D\uDD04 Flow Node ID:', flowNodeId);
    console.log('\u27A1\uFE0F Continue From Node:', continueFromNode);
    console.log('\u2753 User Confirmation Response:', userConfirmationResponse);
    console.log('\uD83D\uDCE6 Pending Context Data:', pendingContextData ? 'present' : 'none');
    console.log('\uD83C\uDFAF Current Group Node ID:', currentGroupNodeId || 'none');
    console.log('\uD83D\uDCE6 Existing Context Data:', existingContextData ? 'present' : 'none');

    if (!buttonId) {
      throw new Error('Button ID is required');
    }

    const buttonResponse = await fetch(`${supabaseUrl}/rest/v1/execute_buttons?id=eq.${buttonId}`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    });

    if (!buttonResponse.ok) {
      throw new Error('Failed to fetch button details');
    }

    const buttons = await buttonResponse.json();
    if (!buttons?.length) {
      throw new Error('Button not found');
    }

    const button = buttons[0];
    console.log('\uD83D\uDCCB Button name:', button.name);
    console.log('\uD83D\uDD00 Has Flow:', button.has_flow);

    if (button.has_flow) {
      const [nodesRes, edgesRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/execute_button_flow_nodes?button_id=eq.${buttonId}`, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          }
        }),
        fetch(`${supabaseUrl}/rest/v1/execute_button_flow_edges?button_id=eq.${buttonId}`, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          }
        })
      ]);

      if (!nodesRes.ok || !edgesRes.ok) {
        throw new Error('Failed to fetch flow data');
      }

      const flowNodes: FlowNode[] = await nodesRes.json();
      const flowEdges: FlowEdge[] = await edgesRes.json();

      console.log('\uD83D\uDCCA Flow nodes:', flowNodes.length);
      console.log('\uD83D\uDD17 Flow edges:', flowEdges.length);

      const executionOrder = buildExecutionOrder(flowNodes, flowEdges);
      console.log('\uD83D\uDCCB Execution order:', executionOrder.map(n => `${n.node_type}:${n.label}`));

      let startIndex = 0;
      let skipCurrentGroup = false;
      let processedAtLeastOneStep = false;
      let contextData: any;

      if (currentGroupNodeId) {
        const groupIndex = executionOrder.findIndex(n => n.id === currentGroupNodeId);
        if (groupIndex !== -1) {
          startIndex = groupIndex + 1;
          skipCurrentGroup = true;
          processedAtLeastOneStep = true;
          console.log(`\uD83C\uDFAF Starting execution after group node at index ${groupIndex}, new startIndex: ${startIndex}`);
        }
      } else if (continueFromNode) {
        startIndex = executionOrder.findIndex(n => n.id === continueFromNode);
        if (startIndex === -1) startIndex = 0;
      }

      const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      if (pendingContextData?.contextData) {
        contextData = pendingContextData.contextData;
        if (executeParameters) {
          contextData.execute = { ...contextData.execute, ...executeParameters };
        }
      } else if (existingContextData) {
        contextData = { ...existingContextData };
        if (executeParameters) {
          contextData.execute = { ...contextData.execute, ...executeParameters };
        }
      } else {
        contextData = {
          execute: executeParameters || {},
          userId,
          buttonId,
          buttonName: button.name,
          timestamp,
          ...executeParameters
        };
      }

      if (userConfirmationResponse !== undefined && pendingContextData) {
        console.log('\uD83D\uDD04 Continuing from user confirmation...');
        console.log('\uD83D\uDCE6 Context data restored');

        const confirmationNodeId = pendingContextData.confirmationNodeId;
        const confirmationNodeIndex = executionOrder.findIndex(n => n.id === confirmationNodeId);
        const confirmationNode = executionOrder[confirmationNodeIndex];

        if (confirmationNode) {
          if (userConfirmationResponse === true) {
            console.log('\u2705 User selected YES - following success path');
            const successEdge = flowEdges.find(e => e.source_node_id === confirmationNodeId && e.source_handle === 'success');
            if (successEdge) {
              contextData.lastEdgeHandle = 'success';
              console.log('\uD83D\uDCCD Setting lastEdgeHandle to: success');
              const targetIdx = executionOrder.findIndex(n => n.id === successEdge.target_node_id);
              if (targetIdx !== -1) {
                startIndex = targetIdx;
                console.log(`\u27A1\uFE0F Jumping to node at index ${startIndex}`);
              }
            } else {
              console.log('\u2139\uFE0F No success edge found, ending workflow');
              return new Response(JSON.stringify({
                success: true,
                buttonName: button.name,
                isFlowBased: true,
                stepsExecuted: 0,
                results: [],
                flowComplete: true,
                message: 'User confirmed - no next step defined'
              }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          } else {
            console.log('\u274C User selected NO - following failure path');
            const failureEdge = flowEdges.find(e => e.source_node_id === confirmationNodeId && e.source_handle === 'failure');
            if (failureEdge) {
              contextData.lastEdgeHandle = 'failure';
              console.log('\uD83D\uDCCD Setting lastEdgeHandle to: failure');
              const targetIdx = executionOrder.findIndex(n => n.id === failureEdge.target_node_id);
              if (targetIdx !== -1) {
                startIndex = targetIdx;
                console.log(`\u27A1\uFE0F Jumping to node at index ${startIndex}`);
              }
            } else {
              console.log('\u2139\uFE0F No failure edge found, ending workflow');
              return new Response(JSON.stringify({
                success: true,
                buttonName: button.name,
                isFlowBased: true,
                stepsExecuted: 0,
                results: [],
                flowComplete: true,
                message: 'User declined - workflow ended'
              }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
          }
        }

        processedAtLeastOneStep = true;
      }

      console.log('\uD83D\uDCE6 Context data execute keys:', Object.keys(contextData.execute || {}));
      console.log('\uD83D\uDCCD Final lastEdgeHandle value:', contextData.lastEdgeHandle);

      const stepResults: any[] = [];
      let nextGroupNode: FlowNode | null = null;

      for (let i = startIndex; i < executionOrder.length; i++) {
        const node = executionOrder[i];

        if (node.node_type === 'group') {
          if (!processedAtLeastOneStep && stepResults.length === 0) {
            console.log(`\u23ED\uFE0F Skipping initial group node: ${node.label}`);
            continue;
          }
          nextGroupNode = node;
          console.log(`\u23F8\uFE0F Pausing at group node: ${node.label}`);
          break;
        }

        if (node.node_type === 'workflow' && node.step_type) {
          console.log(`\n\uD83D\uDD04 Executing workflow node: ${node.label} (${node.step_type})`);

          const step = {
            step_name: node.label,
            step_type: node.step_type,
            config_json: node.config_json || {},
            step_order: i
          };

          try {
            let stepOutput: any = null;

            switch (node.step_type) {
              case 'api_call':
                stepOutput = await executeApiCall(step, contextData);
                break;

              case 'api_endpoint':
                stepOutput = await executeApiEndpoint(step, contextData, supabaseUrl, supabaseServiceKey);
                break;

              case 'conditional_check':
                stepOutput = await executeConditionalCheck(step, contextData);
                if (stepOutput.conditionMet) {
                  const successEdge = flowEdges.find(e => e.source_node_id === node.id && e.source_handle === 'success');
                  if (successEdge) {
                    contextData.lastEdgeHandle = 'success';
                    const targetIdx = executionOrder.findIndex(n => n.id === successEdge.target_node_id);
                    if (targetIdx !== -1 && targetIdx > i) {
                      i = targetIdx - 1;
                    }
                  } else {
                    console.log('\u2139\uFE0F Condition passed with no success edge - ending workflow');
                    i = executionOrder.length;
                  }
                } else {
                  const failureEdge = flowEdges.find(e => e.source_node_id === node.id && e.source_handle === 'failure');
                  if (failureEdge) {
                    contextData.lastEdgeHandle = 'failure';
                    const targetIdx = executionOrder.findIndex(n => n.id === failureEdge.target_node_id);
                    if (targetIdx !== -1 && targetIdx > i) {
                      i = targetIdx - 1;
                    }
                  } else {
                    console.log('\u2139\uFE0F Condition failed with no failure edge - ending workflow');
                    i = executionOrder.length;
                  }
                }
                break;

              case 'email_action':
                stepOutput = await executeEmailAction(step, contextData, supabaseUrl, supabaseServiceKey);
                break;

              case 'ai_lookup':
                stepOutput = await executeAiLookup(step, contextData, supabaseUrl, supabaseServiceKey);
                break;

              case 'google_places_lookup':
                stepOutput = await executeGooglePlacesLookup(step, contextData, supabaseUrl, supabaseServiceKey);
                break;

              case 'user_confirmation': {
                const config = step.config_json || {};
                let processedMessage = config.promptMessage || 'Do you want to continue?';

                processedMessage = processedMessage.replace(/\{\{([^}]+)\}\}/g, (match: string, path: string) => {
                  const trimmedPath = path.trim();
                  const keys = trimmedPath.split('.');
                  let value: any = contextData;
                  for (const key of keys) {
                    if (value && typeof value === 'object' && key in value) {
                      value = value[key];
                    } else {
                      return match;
                    }
                  }
                  return value !== undefined && value !== null ? String(value) : match;
                });

                console.log('\u2753 User confirmation required:', processedMessage);

                let latitude: number | null = null;
                let longitude: number | null = null;
                if (config.showLocationMap && config.latitudeVariable && config.longitudeVariable) {
                  const resolveVariable = (varPath: string): any => {
                    const keys = varPath.split('.');
                    let value: any = contextData;
                    for (const key of keys) {
                      if (value && typeof value === 'object' && key in value) {
                        value = value[key];
                      } else {
                        return null;
                      }
                    }
                    return value;
                  };
                  latitude = resolveVariable(config.latitudeVariable);
                  longitude = resolveVariable(config.longitudeVariable);
                  console.log('\uD83D\uDDFA\uFE0F Map coordinates resolved:', { latitude, longitude });
                }

                return new Response(JSON.stringify({
                  success: true,
                  requiresConfirmation: true,
                  confirmationData: {
                    nodeId: node.id,
                    nodeLabel: node.label,
                    promptMessage: processedMessage,
                    yesButtonLabel: config.yesButtonLabel || 'Yes',
                    noButtonLabel: config.noButtonLabel || 'No',
                    showLocationMap: config.showLocationMap || false,
                    latitude: latitude,
                    longitude: longitude
                  },
                  buttonName: button.name,
                  isFlowBased: true,
                  stepsExecuted: stepResults.length,
                  results: stepResults,
                  pendingContextData: {
                    confirmationNodeId: node.id,
                    contextData,
                    pendingNodeIndex: i
                  },
                  executionOrderLength: executionOrder.length
                }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              case 'exit': {
                const config = step.config_json || {};
                let processedMessage = config.exitMessage || 'Flow completed.';

                processedMessage = processedMessage.replace(/\{\{([^}]+)\}\}/g, (match: string, path: string) => {
                  const trimmedPath = path.trim();
                  const keys = trimmedPath.split('.');
                  let value: any = contextData;
                  for (const key of keys) {
                    if (value && typeof value === 'object' && key in value) {
                      value = value[key];
                    } else {
                      return match;
                    }
                  }
                  return value !== undefined && value !== null ? String(value) : match;
                });

                console.log('\uD83D\uDEAA Exit step reached:', processedMessage);

                return new Response(JSON.stringify({
                  success: true,
                  buttonName: button.name,
                  isFlowBased: true,
                  stepsExecuted: stepResults.length,
                  results: stepResults,
                  flowComplete: true,
                  exitData: {
                    exitMessage: processedMessage,
                    showRestartButton: config.showRestartButton || false
                  }
                }), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              default:
                console.warn(`\u26A0\uFE0F Unknown step type: ${node.step_type}`);
                stepOutput = { warning: `Unknown step type: ${node.step_type}` };
            }

            console.log(`\u2705 Node ${node.label} completed`);
            stepResults.push({ node: node.label, status: 'completed', output: stepOutput });

            const nonBranchingSteps = ['api_call', 'api_endpoint', 'email_action', 'ai_lookup', 'google_places_lookup'];
            if (nonBranchingSteps.includes(node.step_type || '')) {
              const outgoingEdge = flowEdges.find(e => e.source_node_id === node.id);
              if (outgoingEdge) {
                const targetIdx = executionOrder.findIndex(n => n.id === outgoingEdge.target_node_id);
                if (targetIdx !== -1) {
                  console.log(`\u27A1\uFE0F Following edge to node at index ${targetIdx}`);
                  i = targetIdx - 1;
                }
              } else {
                console.log(`\u23F9\uFE0F No outgoing edge from ${node.label} - ending flow`);
                i = executionOrder.length;
              }
            }

          } catch (stepError) {
            console.error(`\u274C Node ${node.label} failed:`, stepError);
            const errorResult: any = {
              node: node.label,
              status: 'failed',
              error: stepError instanceof Error ? stepError.message : 'Unknown error'
            };
            if (stepError && typeof stepError === 'object') {
              if ((stepError as any).requestUrl) {
                errorResult.requestUrl = (stepError as any).requestUrl;
              }
              if ((stepError as any).requestBody) {
                errorResult.requestBody = (stepError as any).requestBody;
              }
              if ((stepError as any).httpMethod) {
                errorResult.httpMethod = (stepError as any).httpMethod;
              }
            }
            stepResults.push(errorResult);
            return new Response(JSON.stringify({
              success: false,
              buttonName: button.name,
              isFlowBased: true,
              error: stepError instanceof Error ? stepError.message : 'Unknown error',
              results: stepResults
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }

      console.log('\u2705 === FLOW EXECUTION COMPLETE ===');

      return new Response(JSON.stringify({
        success: true,
        buttonName: button.name,
        isFlowBased: true,
        stepsExecuted: stepResults.length,
        results: stepResults,
        nextGroupNode: nextGroupNode ? {
          id: nextGroupNode.id,
          label: nextGroupNode.label,
          groupId: nextGroupNode.group_id
        } : null,
        flowComplete: !nextGroupNode,
        contextData
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stepsResponse = await fetch(`${supabaseUrl}/rest/v1/execute_button_steps?button_id=eq.${buttonId}&is_enabled=eq.true&order=step_order.asc`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    });

    if (!stepsResponse.ok) {
      throw new Error('Failed to fetch button steps');
    }

    const steps = await stepsResponse.json();
    console.log('\uD83D\uDCCA Found', steps.length, 'enabled steps');

    if (steps.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No steps configured for this button',
        stepsExecuted: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const contextData: any = {
      execute: executeParameters || {},
      userId,
      buttonId,
      buttonName: button.name,
      timestamp,
      ...executeParameters
    };

    console.log('\uD83D\uDD04 Starting step execution...');
    let lastApiResponse: any = null;
    const stepResults: any[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`\n\uD83D\uDD04 Step ${step.step_order}: ${step.step_name} (${step.step_type})`);

      const config = step.config_json || {};
      let shouldSkip = false;

      if (config.skipIf) {
        const skipValue = getValueByPath(contextData.execute, config.skipIf) ?? getValueByPath(contextData, config.skipIf);
        if (skipValue === true) {
          console.log(`\u23ED\uFE0F Skipping: skipIf condition met`);
          shouldSkip = true;
        }
      }

      if (!shouldSkip && config.runIf) {
        const runValue = getValueByPath(contextData.execute, config.runIf) ?? getValueByPath(contextData, config.runIf);
        if (runValue !== true) {
          console.log(`\u23ED\uFE0F Skipping: runIf condition not met`);
          shouldSkip = true;
        }
      }

      if (shouldSkip) {
        stepResults.push({ step: step.step_name, status: 'skipped' });
        continue;
      }

      try {
        let stepOutput: any = null;

        switch (step.step_type) {
          case 'api_call':
            stepOutput = await executeApiCall(step, contextData);
            lastApiResponse = stepOutput;
            break;

          case 'api_endpoint':
            stepOutput = await executeApiEndpoint(step, contextData, supabaseUrl, supabaseServiceKey);
            lastApiResponse = stepOutput;
            break;

          case 'conditional_check':
            stepOutput = await executeConditionalCheck(step, contextData);
            if (stepOutput.conditionMet && step.next_step_on_success_id) {
              const targetIdx = steps.findIndex((s: any) => s.id === step.next_step_on_success_id);
              if (targetIdx !== -1) i = targetIdx - 1;
            } else if (!stepOutput.conditionMet && step.next_step_on_failure_id) {
              const targetIdx = steps.findIndex((s: any) => s.id === step.next_step_on_failure_id);
              if (targetIdx !== -1) i = targetIdx - 1;
            }
            break;

          case 'email_action':
            stepOutput = await executeEmailAction(step, contextData, supabaseUrl, supabaseServiceKey);
            break;

          case 'ai_lookup':
            stepOutput = await executeAiLookup(step, contextData, supabaseUrl, supabaseServiceKey);
            break;

          case 'google_places_lookup':
            stepOutput = await executeGooglePlacesLookup(step, contextData, supabaseUrl, supabaseServiceKey);
            break;

          case 'data_transform':
            console.log('\uD83D\uDD27 Data transform step - processing');
            stepOutput = { transformed: true };
            break;

          default:
            console.warn(`\u26A0\uFE0F Unknown step type: ${step.step_type}`);
            stepOutput = { warning: `Unknown step type: ${step.step_type}` };
        }

        console.log(`\u2705 Step ${step.step_order} completed`);
        stepResults.push({ step: step.step_name, status: 'completed', output: stepOutput });

      } catch (stepError) {
        console.error(`\u274C Step ${step.step_order} failed:`, stepError);
        const errorResult: any = {
          step: step.step_name,
          status: 'failed',
          error: stepError instanceof Error ? stepError.message : 'Unknown error'
        };
        if (stepError && typeof stepError === 'object') {
          if ((stepError as any).requestUrl) {
            errorResult.requestUrl = (stepError as any).requestUrl;
          }
          if ((stepError as any).requestBody) {
            errorResult.requestBody = (stepError as any).requestBody;
          }
          if ((stepError as any).httpMethod) {
            errorResult.httpMethod = (stepError as any).httpMethod;
          }
        }
        stepResults.push(errorResult);
        return new Response(JSON.stringify({
          success: false,
          buttonName: button.name,
          error: stepError instanceof Error ? stepError.message : 'Unknown error',
          results: stepResults
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log('\u2705 === EXECUTE BUTTON PROCESSOR COMPLETE ===');

    return new Response(JSON.stringify({
      success: true,
      buttonName: button.name,
      stepsExecuted: stepResults.length,
      results: stepResults
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('\u274C Execute button processor error:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});