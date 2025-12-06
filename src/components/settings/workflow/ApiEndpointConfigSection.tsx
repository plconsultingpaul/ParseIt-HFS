import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Info, Braces, ExternalLink, AlertCircle, Plus, Trash2, FileText, Save } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import Select from '../../common/Select';
import VariableDropdown from './VariableDropdown';

interface ApiEndpointConfigSectionProps {
  config: any;
  onChange: (config: any) => void;
  allSteps?: any[];
  currentStepOrder?: number;
  extractionType?: any;
}

interface SecondaryApi {
  id: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
}

interface ApiSpec {
  id: string;
  name: string;
  api_endpoint_id?: string;
  secondary_api_id?: string;
}

interface ApiSpecEndpoint {
  id: string;
  path: string;
  method: string;
  summary: string;
}

interface QueryParameter {
  id: string;
  field_name: string;
  field_type: string;
  is_required: boolean;
  description: string;
  example?: string;
  test_default?: string;
}

interface RequestBodyFieldMapping {
  fieldName: string;
  type: 'hardcoded' | 'variable';
  value: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime' | 'boolean';
}

export default function ApiEndpointConfigSection({ config, onChange, allSteps = [], currentStepOrder, extractionType }: ApiEndpointConfigSectionProps) {
  const [apiSourceType, setApiSourceType] = useState<'main' | 'secondary'>(config?.apiSourceType || 'main');
  const [secondaryApis, setSecondaryApis] = useState<SecondaryApi[]>([]);
  const [selectedSecondaryApiId, setSelectedSecondaryApiId] = useState(config?.secondaryApiId || '');
  const [httpMethod, setHttpMethod] = useState(config?.httpMethod || 'POST');
  const [apiSpecs, setApiSpecs] = useState<ApiSpec[]>([]);
  const [selectedApiSpecId, setSelectedApiSpecId] = useState('');
  const [availableEndpoints, setAvailableEndpoints] = useState<ApiSpecEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiSpecEndpoint | null>(null);
  const [queryParameters, setQueryParameters] = useState<QueryParameter[]>([]);
  const [queryParameterConfig, setQueryParameterConfig] = useState<Record<string, { enabled: boolean; value: string }>>(
    config?.queryParameterConfig || {}
  );
  const [manualApiEntry, setManualApiEntry] = useState(config?.manualApiEntry || false);
  const [manualApiPath, setManualApiPath] = useState(config?.apiPath || '');
  const [responseDataMappings, setResponseDataMappings] = useState<Array<{ responsePath: string; updatePath: string }>>([
    { responsePath: '', updatePath: '' }
  ]);
  const [mainApiConfig, setMainApiConfig] = useState<any>(null);
  const [selectedSecondaryApi, setSelectedSecondaryApi] = useState<SecondaryApi | null>(null);
  const [escapeSingleQuotesInBody, setEscapeSingleQuotesInBody] = useState(config?.escapeSingleQuotesInBody !== false);
  const [openVariableDropdown, setOpenVariableDropdown] = useState<string | null>(null);
  const [pathVariableConfig, setPathVariableConfig] = useState<Record<string, string>>(
    config?.pathVariableConfig || {}
  );
  const [requestBodyTemplate, setRequestBodyTemplate] = useState(config?.requestBodyTemplate || '');
  const [requestBodyFieldMappings, setRequestBodyFieldMappings] = useState<RequestBodyFieldMapping[]>(
    config?.requestBodyFieldMappings || []
  );
  const buttonRefs = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({});
  const isRestoringRef = useRef(false);
  const isInitialMountRef = useRef(true);

  const endpointOptions = useMemo(() => {
    return availableEndpoints.map(endpoint => ({
      value: endpoint.id,
      label: `${endpoint.path}${endpoint.summary ? ` - ${endpoint.summary}` : ''}`
    }));
  }, [availableEndpoints]);

  useEffect(() => {
    loadSecondaryApis();
    loadMainApiConfig();
  }, []);

  useEffect(() => {
    restoreConfigFromProps();
  }, [config]);

  useEffect(() => {
    loadApiSpecs();
  }, [apiSourceType, selectedSecondaryApiId]);

  useEffect(() => {
    if (selectedApiSpecId) {
      loadAvailableEndpoints();
    }
  }, [selectedApiSpecId, httpMethod]);

  useEffect(() => {
    if (selectedEndpoint) {
      loadQueryParameters();
    }
  }, [selectedEndpoint]);

  useEffect(() => {
    updateParentConfig();
  }, [apiSourceType, selectedSecondaryApiId, httpMethod, selectedEndpoint, queryParameterConfig, pathVariableConfig, manualApiEntry, manualApiPath, responseDataMappings, escapeSingleQuotesInBody, requestBodyTemplate, requestBodyFieldMappings]);

  const restoreConfigFromProps = async () => {
    if (!config || !config.apiSpecEndpointId) {
      isInitialMountRef.current = false;
      return;
    }

    isRestoringRef.current = true;

    try {
      console.log('Restoring config from props:', config);

      // Restore API source type
      if (config.apiSourceType && config.apiSourceType !== apiSourceType) {
        setApiSourceType(config.apiSourceType);
      }

      // Restore secondary API ID and selection
      if (config.secondaryApiId && config.secondaryApiId !== selectedSecondaryApiId) {
        setSelectedSecondaryApiId(config.secondaryApiId);
      }

      // Restore HTTP method from config first
      if (config.httpMethod && config.httpMethod !== httpMethod) {
        setHttpMethod(config.httpMethod);
      }

      // Restore manual API entry state
      if (config.manualApiEntry !== undefined && config.manualApiEntry !== manualApiEntry) {
        setManualApiEntry(config.manualApiEntry);
      }

      // Restore manual API path
      if (config.apiPath && config.apiPath !== manualApiPath) {
        setManualApiPath(config.apiPath);
      }

      // Restore response data mappings - support both old and new formats
      if (config.responseDataMappings && Array.isArray(config.responseDataMappings)) {
        setResponseDataMappings(config.responseDataMappings);
      } else if (config.responsePath || config.updateJsonPath) {
        setResponseDataMappings([{
          responsePath: config.responsePath || '',
          updatePath: config.updateJsonPath || ''
        }]);
      } else {
        setResponseDataMappings([{ responsePath: '', updatePath: '' }]);
      }

      // Restore escape single quotes setting
      if (config.escapeSingleQuotesInBody !== undefined && config.escapeSingleQuotesInBody !== escapeSingleQuotesInBody) {
        setEscapeSingleQuotesInBody(config.escapeSingleQuotesInBody);
      }

      // Restore query parameter config
      if (config.queryParameterConfig) {
        setQueryParameterConfig(config.queryParameterConfig);
      }

      // Restore path variable config
      if (config.pathVariableConfig) {
        setPathVariableConfig(config.pathVariableConfig);
      }

      // Restore request body template
      if (config.requestBodyTemplate !== undefined && config.requestBodyTemplate !== requestBodyTemplate) {
        setRequestBodyTemplate(config.requestBodyTemplate);
      }

      // Restore request body field mappings
      if (config.requestBodyFieldMappings && Array.isArray(config.requestBodyFieldMappings)) {
        setRequestBodyFieldMappings(config.requestBodyFieldMappings);
      }

      // Load the API spec endpoint to get the spec ID
      const { data: endpointData, error: endpointError } = await supabase
        .from('api_spec_endpoints')
        .select('*, api_specs!inner(id, name)')
        .eq('id', config.apiSpecEndpointId)
        .maybeSingle();

      if (!endpointError && endpointData) {
        console.log('Loaded endpoint data:', endpointData);

        // Set the API spec ID from the loaded endpoint
        const apiSpecId = endpointData.api_spec_id;
        if (apiSpecId && apiSpecId !== selectedApiSpecId) {
          setSelectedApiSpecId(apiSpecId);
        }

        // Set the selected endpoint
        const endpoint: ApiSpecEndpoint = {
          id: endpointData.id,
          path: endpointData.path,
          method: endpointData.method,
          summary: endpointData.summary || ''
        };

        if (!selectedEndpoint || selectedEndpoint.id !== endpoint.id) {
          setSelectedEndpoint(endpoint);
        }
      }

      isInitialMountRef.current = false;
    } finally {
      isRestoringRef.current = false;
    }
  };

  const loadMainApiConfig = async () => {
    const { data, error } = await supabase
      .from('api_settings')
      .select('*')
      .maybeSingle();

    if (!error && data) {
      setMainApiConfig(data);
    }
  };

  const loadSecondaryApis = async () => {
    const { data, error } = await supabase
      .from('secondary_api_configs')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (!error && data) {
      setSecondaryApis(data.map(api => ({
        id: api.id,
        name: api.name,
        baseUrl: api.base_url,
        isActive: api.is_active
      })));
    }
  };

  const loadApiSpecs = async () => {
    let query = supabase.from('api_specs').select('*');

    if (apiSourceType === 'main') {
      query = query.not('api_endpoint_id', 'is', null);
    } else if (apiSourceType === 'secondary' && selectedSecondaryApiId) {
      query = query.eq('secondary_api_id', selectedSecondaryApiId);
    } else {
      setApiSpecs([]);
      return;
    }

    const { data, error } = await query.order('uploaded_at', { ascending: false });

    if (!error && data) {
      setApiSpecs(data);
      if (data.length > 0 && !selectedApiSpecId) {
        setSelectedApiSpecId(data[0].id);
      }
    }
  };

  const loadAvailableEndpoints = async () => {
    if (!selectedApiSpecId) {
      setAvailableEndpoints([]);
      return;
    }

    const { data, error } = await supabase
      .from('api_spec_endpoints')
      .select('*')
      .eq('api_spec_id', selectedApiSpecId)
      .eq('method', httpMethod)
      .order('path');

    if (!error && data) {
      setAvailableEndpoints(data);
    }
  };

  const loadQueryParameters = async () => {
    if (!selectedEndpoint) {
      setQueryParameters([]);
      return;
    }

    const { data, error } = await supabase
      .from('api_endpoint_fields')
      .select('*')
      .eq('api_spec_endpoint_id', selectedEndpoint.id)
      .like('field_path', '[query]%')
      .order('field_name');

    if (!error && data) {
      const params = data.map(field => ({
        id: field.id,
        field_name: field.field_name,
        field_type: field.field_type,
        is_required: field.is_required,
        description: field.description || '',
        example: field.example,
        test_default: field.test_default
      }));
      setQueryParameters(params);

      const newConfig = { ...queryParameterConfig };
      params.forEach(param => {
        if (!(param.field_name in newConfig)) {
          newConfig[param.field_name] = {
            enabled: param.is_required,
            value: ''
          };
        }
      });
      setQueryParameterConfig(newConfig);
    }
  };

  const handleEndpointChange = (endpointId: string) => {
    const endpoint = availableEndpoints.find(e => e.id === endpointId);
    setSelectedEndpoint(endpoint || null);
    if (endpoint) {
      setManualApiPath(endpoint.path);
    }
  };

  const handleParameterToggle = (fieldName: string) => {
    setQueryParameterConfig(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        enabled: !prev[fieldName]?.enabled
      }
    }));
  };

  const handleParameterValueChange = (fieldName: string, value: string) => {
    setQueryParameterConfig(prev => ({
      ...prev,
      [fieldName]: {
        ...prev[fieldName],
        value
      }
    }));
  };

  const addResponseMapping = () => {
    setResponseDataMappings([...responseDataMappings, { responsePath: '', updatePath: '' }]);
  };

  const removeResponseMapping = (index: number) => {
    if (responseDataMappings.length > 1) {
      setResponseDataMappings(responseDataMappings.filter((_, i) => i !== index));
    }
  };

  const updateResponseMapping = (index: number, field: 'responsePath' | 'updatePath', value: string) => {
    const updated = [...responseDataMappings];
    updated[index][field] = value;
    setResponseDataMappings(updated);
  };

  const handleClearAll = () => {
    const newConfig = { ...queryParameterConfig };
    queryParameters.forEach(param => {
      if (!param.is_required) {
        newConfig[param.field_name] = {
          enabled: false,
          value: ''
        };
      }
    });
    setQueryParameterConfig(newConfig);
  };

  const getQueryString = (): string => {
    const params = new URLSearchParams();
    Object.entries(queryParameterConfig).forEach(([key, config]) => {
      if (config.enabled && config.value) {
        params.append(key, config.value);
      }
    });
    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  };

  const getCleanQueryString = (): string => {
    const params: string[] = [];
    Object.entries(queryParameterConfig).forEach(([key, config]) => {
      if (config.enabled && config.value) {
        params.push(`${key}=${config.value}`);
      }
    });
    return params.length > 0 ? `?${params.join('&')}` : '';
  };

  const getBaseUrl = (): string => {
    if (apiSourceType === 'main') {
      return mainApiConfig?.path || '';
    } else if (selectedSecondaryApi) {
      return selectedSecondaryApi.baseUrl || '';
    }
    return '';
  };

  const getFullUrlWithQuery = (): string => {
    const baseUrl = getBaseUrl();
    const path = manualApiEntry ? manualApiPath : (selectedEndpoint?.path || '');
    const queryString = getQueryString();
    return `${baseUrl}${path}${queryString}`;
  };

  const getCleanUrlPreview = (): string => {
    const baseUrl = getBaseUrl();
    const path = manualApiEntry ? manualApiPath : (selectedEndpoint?.path || '');
    const queryString = getCleanQueryString();
    return `${baseUrl}${path}${queryString}`;
  };

  const detectVariables = (text: string): string[] => {
    const regex = /\{([^}]+)\}|\$\{([^}]+)\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1] || match[2]);
    }
    return matches;
  };

  const getPathVariables = (): string[] => {
    const path = manualApiEntry ? manualApiPath : (selectedEndpoint?.path || '');
    return detectVariables(path);
  };

  const getAllDetectedVariables = (): string[] => {
    const variables = new Set<string>();

    const pathVars = detectVariables(manualApiPath);
    pathVars.forEach(v => variables.add(v));

    Object.entries(queryParameterConfig).forEach(([key, config]) => {
      if (config.enabled && config.value) {
        const valueVars = detectVariables(config.value);
        valueVars.forEach(v => variables.add(v));
      }
    });

    return Array.from(variables);
  };

  const getAvailableVariables = (): Array<{ name: string; stepName: string; source: 'extraction' | 'workflow'; dataType?: string }> => {
    const variables: Array<{ name: string; stepName: string; source: 'extraction' | 'workflow'; dataType?: string }> = [];

    if (extractionType && extractionType.fieldMappings) {
      extractionType.fieldMappings.forEach((mapping: any) => {
        if (mapping.fieldName) {
          variables.push({
            name: mapping.fieldName,
            stepName: 'PDF Extraction',
            source: 'extraction',
            dataType: mapping.dataType || 'string'
          });
        }
      });
    }

    if (allSteps && currentStepOrder) {
      const previousSteps = allSteps.filter(s => s.stepOrder < currentStepOrder);

      previousSteps.forEach(step => {
        const stepName = step.stepName || step.step_name || 'Unknown Step';
        const config = step.configJson || step.config_json;

        if (config && config.responseDataMappings && Array.isArray(config.responseDataMappings)) {
          config.responseDataMappings.forEach((mapping: any) => {
            if (mapping.updatePath) {
              variables.push({
                name: mapping.updatePath,
                stepName: stepName,
                source: 'workflow',
                dataType: undefined
              });
            }
          });
        }
      });
    }

    return variables;
  };

  const getButtonRef = (key: string): React.RefObject<HTMLButtonElement> => {
    if (!buttonRefs.current[key]) {
      buttonRefs.current[key] = React.createRef<HTMLButtonElement>();
    }
    return buttonRefs.current[key];
  };

  const handleInsertVariable = (fieldName: string, variableName: string) => {
    const currentValue = queryParameterConfig[fieldName]?.value || '';
    const newValue = currentValue ? `${currentValue}{{${variableName}}}` : `{{${variableName}}}`;
    handleParameterValueChange(fieldName, newValue);
    setOpenVariableDropdown(null);
  };

  const handlePathVariableChange = (variableName: string, value: string) => {
    setPathVariableConfig(prev => ({
      ...prev,
      [variableName]: value
    }));
  };

  const handleInsertPathVariable = (variableName: string, insertValue: string) => {
    const currentValue = pathVariableConfig[variableName] || '';
    const newValue = currentValue ? `${currentValue}{{${insertValue}}}` : `{{${insertValue}}}`;
    handlePathVariableChange(variableName, newValue);
    setOpenVariableDropdown(null);
  };

  const generateRequestBodyFieldMappings = () => {
    if (!requestBodyTemplate) {
      alert('Please add a JSON template first');
      return;
    }

    try {
      const template = JSON.parse(requestBodyTemplate);
      const fieldMappings: RequestBodyFieldMapping[] = [];

      const extractFields = (obj: any, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const fieldName = prefix ? `${prefix}.${key}` : key;

          if (Array.isArray(value) && value.length > 0) {
            const firstItem = value[0];
            if (firstItem && typeof firstItem === 'object') {
              extractFields(firstItem, `${fieldName}[0]`);
            }
          } else if (value && typeof value === 'object') {
            extractFields(value, fieldName);
          } else {
            let dataType: 'string' | 'number' | 'integer' | 'datetime' | 'boolean' = 'string';

            if (typeof value === 'number') {
              dataType = Number.isInteger(value) ? 'integer' : 'number';
            } else if (typeof value === 'boolean') {
              dataType = 'boolean';
            } else if (typeof value === 'string') {
              if (/^\d{4}-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12]\d)((T| )([01]\d|2[0-3]):([0-5]\d):([0-5]\d))?$/.test(value)) {
                dataType = 'datetime';
              }
            }

            fieldMappings.push({
              fieldName: fieldName,
              type: 'hardcoded',
              value: '',
              dataType
            });
          }
        }
      };

      extractFields(template);
      setRequestBodyFieldMappings(fieldMappings);
    } catch (error) {
      alert('Invalid JSON template. Please check the JSON syntax.');
    }
  };

  const addRequestBodyFieldMapping = () => {
    const newMapping: RequestBodyFieldMapping = {
      fieldName: '',
      type: 'hardcoded',
      value: '',
      dataType: 'string'
    };
    setRequestBodyFieldMappings([...requestBodyFieldMappings, newMapping]);
  };

  const updateRequestBodyFieldMapping = (index: number, field: keyof RequestBodyFieldMapping, value: any) => {
    const updated = [...requestBodyFieldMappings];
    updated[index] = { ...updated[index], [field]: value };
    setRequestBodyFieldMappings(updated);
  };

  const removeRequestBodyFieldMapping = (index: number) => {
    setRequestBodyFieldMappings(requestBodyFieldMappings.filter((_, i) => i !== index));
  };

  const handleInsertRequestBodyVariable = (index: number, variableName: string) => {
    const currentValue = requestBodyFieldMappings[index]?.value || '';
    const newValue = currentValue ? `${currentValue}{{${variableName}}}` : `{{${variableName}}}`;
    updateRequestBodyFieldMapping(index, 'value', newValue);
    setOpenVariableDropdown(null);
  };

  const updateParentConfig = () => {
    if (isRestoringRef.current || isInitialMountRef.current) {
      return;
    }

    const newConfig = {
      apiSourceType,
      apiEndpointId: apiSourceType === 'main' ? 'main' : undefined,
      secondaryApiId: apiSourceType === 'secondary' ? selectedSecondaryApiId : undefined,
      httpMethod,
      apiSpecEndpointId: selectedEndpoint?.id,
      apiPath: manualApiEntry ? manualApiPath : (selectedEndpoint?.path || ''),
      queryParameterConfig,
      pathVariableConfig: Object.keys(pathVariableConfig).length > 0 ? pathVariableConfig : undefined,
      responseDataMappings: responseDataMappings.filter(m => m.responsePath || m.updatePath).length > 0
        ? responseDataMappings.filter(m => m.responsePath && m.updatePath)
        : undefined,
      manualApiEntry,
      escapeSingleQuotesInBody,
      requestBodyTemplate: requestBodyTemplate || undefined,
      requestBodyFieldMappings: requestBodyFieldMappings.length > 0 ? requestBodyFieldMappings : undefined
    };

    if (!newConfig.apiSourceType || !newConfig.httpMethod) {
      return;
    }

    onChange(newConfig);
  };

  const detectedVariables = getAllDetectedVariables();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Source
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="main"
                checked={apiSourceType === 'main'}
                onChange={(e) => {
                  setApiSourceType(e.target.value as 'main' | 'secondary');
                  setSelectedSecondaryApiId('');
                }}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Main API</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="secondary"
                checked={apiSourceType === 'secondary'}
                onChange={(e) => setApiSourceType(e.target.value as 'main' | 'secondary')}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Secondary API</span>
            </label>
          </div>
        </div>

        {apiSourceType === 'secondary' && (
          <div>
            <Select
              label="Secondary API"
              value={selectedSecondaryApiId}
              onValueChange={(value) => {
                setSelectedSecondaryApiId(value);
                const api = secondaryApis.find(a => a.id === value);
                setSelectedSecondaryApi(api || null);
              }}
              options={secondaryApis.map(api => ({
                value: api.id,
                label: `${api.name} (${api.baseUrl})`
              }))}
              required
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Select
            label="HTTP Method"
            value={httpMethod}
            onValueChange={setHttpMethod}
            options={[
              { value: 'GET', label: 'GET' },
              { value: 'POST', label: 'POST' },
              { value: 'PUT', label: 'PUT' },
              { value: 'PATCH', label: 'PATCH' },
              { value: 'DELETE', label: 'DELETE' }
            ]}
            searchable={false}
          />
        </div>

        {apiSpecs.length > 0 && (
          <div>
            <Select
              label="API Specification"
              value={selectedApiSpecId}
              onValueChange={setSelectedApiSpecId}
              options={apiSpecs.map(spec => ({
                value: spec.id,
                label: spec.name
              }))}
            />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="manualApiEntry"
          checked={manualApiEntry}
          onChange={(e) => setManualApiEntry(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500"
        />
        <label htmlFor="manualApiEntry" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Enter API path manually
        </label>
      </div>

      {manualApiEntry ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Path
          </label>
          <input
            type="text"
            value={manualApiPath}
            onChange={(e) => setManualApiPath(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100"
            placeholder="/api/orders"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Enter the API endpoint path. Use {'{variable}'} for path variables.
          </p>
        </div>
      ) : availableEndpoints.length > 0 ? (
        <div>
          <Select
            label="API Endpoint"
            value={selectedEndpoint?.id || ''}
            onValueChange={handleEndpointChange}
            options={endpointOptions}
          />
        </div>
      ) : (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            No endpoints found for the selected API specification and HTTP method. Try selecting a different specification or enable manual entry.
          </p>
        </div>
      )}

      {getPathVariables().length > 0 && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Path Variables
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure values for path variables in the URL
          </p>

          <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 w-64">Variable</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Value</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {getPathVariables().map(variable => (
                  <tr key={variable}>
                    <td className="px-3 py-2">
                      <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                        {'{' + variable + '}'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={pathVariableConfig[variable] || ''}
                          onChange={(e) => handlePathVariableChange(variable, e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono dark:bg-gray-700 dark:text-gray-100"
                          placeholder="value or {{variableName}}"
                        />
                        <button
                          ref={getButtonRef(`path_${variable}`)}
                          type="button"
                          onClick={() => setOpenVariableDropdown(openVariableDropdown === `path_${variable}` ? null : `path_${variable}`)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                          title="Insert variable from previous step"
                        >
                          <Braces className="w-4 h-4" />
                        </button>
                        <VariableDropdown
                          isOpen={openVariableDropdown === `path_${variable}`}
                          onClose={() => setOpenVariableDropdown(null)}
                          triggerRef={getButtonRef(`path_${variable}`)}
                          variables={getAvailableVariables()}
                          onSelect={(varName) => handleInsertPathVariable(variable, varName)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {queryParameters.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Query Parameters
            </label>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Clear All
            </button>
          </div>

          <div className="border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 w-24">Enabled</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 w-64">Parameter</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Value</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {queryParameters.map(param => (
                  <tr key={param.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={queryParameterConfig[param.field_name]?.enabled || false}
                          onChange={() => handleParameterToggle(param.field_name)}
                          disabled={param.is_required}
                          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                        />
                        {param.description && (
                          <button
                            type="button"
                            title={param.description}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                          {param.field_name}
                        </span>
                        {param.is_required && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 rounded">
                            Required
                          </span>
                        )}
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded">
                          {param.field_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={queryParameterConfig[param.field_name]?.value || ''}
                          onChange={(e) => handleParameterValueChange(param.field_name, e.target.value)}
                          disabled={!queryParameterConfig[param.field_name]?.enabled}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm font-mono dark:bg-gray-700 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:text-gray-400"
                          placeholder={param.example || param.test_default || 'value'}
                        />
                        <button
                          ref={getButtonRef(`query_${param.field_name}`)}
                          type="button"
                          onClick={() => setOpenVariableDropdown(openVariableDropdown === param.field_name ? null : param.field_name)}
                          disabled={!queryParameterConfig[param.field_name]?.enabled}
                          className="p-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Insert variable from previous step"
                        >
                          <Braces className="w-4 h-4" />
                        </button>
                        <VariableDropdown
                          isOpen={openVariableDropdown === param.field_name}
                          onClose={() => setOpenVariableDropdown(null)}
                          triggerRef={getButtonRef(`query_${param.field_name}`)}
                          variables={getAvailableVariables()}
                          onSelect={(varName) => handleInsertVariable(param.field_name, varName)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'PATCH') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Request Body
            </label>
            <button
              type="button"
              onClick={generateRequestBodyFieldMappings}
              className="flex items-center px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              <FileText className="w-4 h-4 mr-1" />
              Map JSON
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter the JSON structure for the request body
          </p>

          <textarea
            value={requestBodyTemplate}
            onChange={(e) => setRequestBodyTemplate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100"
            rows={8}
            placeholder={`{\n  "customLabel": "AAAAAA",\n  "customDefId": 0,\n  "customValue": "string"\n}`}
          />

          {requestBodyFieldMappings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Field Mappings
                </label>
                <button
                  type="button"
                  onClick={addRequestBodyFieldMapping}
                  className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Field
                </button>
              </div>

              <div className="space-y-3">
                {requestBodyFieldMappings.map((mapping, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 ${
                      mapping.type === 'hardcoded'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Field Name
                        </label>
                        <input
                          type="text"
                          value={mapping.fieldName}
                          onChange={(e) => updateRequestBodyFieldMapping(index, 'fieldName', e.target.value)}
                          className={`w-full px-2 py-1 border-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                            mapping.type === 'hardcoded'
                              ? 'border-green-400 dark:border-green-500'
                              : 'border-blue-400 dark:border-blue-500'
                          }`}
                          placeholder="fieldName"
                        />
                      </div>
                      <div>
                        <Select
                          label="Type"
                          value={mapping.type}
                          onValueChange={(value) => updateRequestBodyFieldMapping(index, 'type', value as 'hardcoded' | 'variable')}
                          options={[
                            { value: 'hardcoded', label: 'Hardcoded' },
                            { value: 'variable', label: 'Variable' }
                          ]}
                          searchable={false}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {mapping.type === 'hardcoded' ? 'Value' : 'Variable Value'}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={mapping.value}
                            onChange={(e) => updateRequestBodyFieldMapping(index, 'value', e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                            placeholder={
                              mapping.type === 'hardcoded' ? 'Fixed value' : '{{variableName}}'
                            }
                          />
                          {mapping.type === 'variable' && (
                            <>
                              <button
                                ref={getButtonRef(`reqbody_${index}`)}
                                type="button"
                                onClick={() => setOpenVariableDropdown(openVariableDropdown === `reqbody_${index}` ? null : `reqbody_${index}`)}
                                className="p-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                title="Insert variable from previous step"
                              >
                                <Braces className="w-4 h-4" />
                              </button>
                              <VariableDropdown
                                isOpen={openVariableDropdown === `reqbody_${index}`}
                                onClose={() => setOpenVariableDropdown(null)}
                                triggerRef={getButtonRef(`reqbody_${index}`)}
                                variables={getAvailableVariables()}
                                onSelect={(varName) => handleInsertRequestBodyVariable(index, varName)}
                              />
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-end space-x-2">
                        <div className="flex-1">
                          <Select
                            label="Data Type"
                            value={mapping.dataType || 'string'}
                            onValueChange={(value) => updateRequestBodyFieldMapping(index, 'dataType', value as 'string' | 'number' | 'integer' | 'datetime' | 'boolean')}
                            options={[
                              { value: 'string', label: 'String' },
                              { value: 'number', label: 'Number' },
                              { value: 'integer', label: 'Integer' },
                              { value: 'datetime', label: 'DateTime' },
                              { value: 'boolean', label: 'Boolean' }
                            ]}
                            searchable={false}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRequestBodyFieldMapping(index)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                <p className="text-xs text-purple-700 dark:text-purple-400">
                  <strong>Field Mappings:</strong> Use "Hardcoded" for fixed values or "Variable" to insert data from previous workflow steps. Variables use the format {'{{'} variableName {'}}'}.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="escapeSingleQuotesInBody"
            checked={escapeSingleQuotesInBody}
            onChange={(e) => setEscapeSingleQuotesInBody(e.target.checked)}
            className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500"
          />
          <div className="flex-1">
            <label htmlFor="escapeSingleQuotesInBody" className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer">
              Escape Single Quotes for OData Filters
            </label>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Enable this when using OData $filter syntax. Converts single quotes to double quotes (e.g., "O'Hare" becomes "O''Hare") in all placeholder values in the URL and request body.
            </p>
          </div>
        </div>
      </div>

      {detectedVariables.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <div className="flex items-start space-x-2">
            <Braces className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                Variables Detected
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                The following variables will be replaced with extracted data at runtime:
              </p>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((variable, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs font-mono bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 rounded"
                  >
                    {'{' + variable + '}'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
        <div className="flex items-start space-x-2 mb-2">
          <ExternalLink className="w-4 h-4 text-slate-600 dark:text-slate-400 flex-shrink-0 mt-0.5" />
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Full URL Preview:
          </label>
        </div>
        <div className="ml-6 p-2 bg-white dark:bg-gray-900 border border-slate-300 dark:border-slate-600 rounded font-mono text-xs text-slate-900 dark:text-slate-100 break-all">
          {getCleanUrlPreview() || 'Configure endpoint to see URL preview'}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Response Data Mappings
          </label>
          <button
            type="button"
            onClick={addResponseMapping}
            className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Mapping
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Extract multiple values from API response and store them in different locations in your extracted JSON data
        </p>

        {responseDataMappings.map((mapping, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <div className="flex-1 space-y-2">
              <div>
                <input
                  type="text"
                  value={mapping.responsePath}
                  onChange={(e) => updateResponseMapping(index, 'responsePath', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-600 dark:text-gray-100"
                  placeholder="Response path (e.g., data.result or items[0].value)"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  JSON path to extract from API response
                </p>
              </div>
              <div>
                <input
                  type="text"
                  value={mapping.updatePath}
                  onChange={(e) => updateResponseMapping(index, 'updatePath', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm dark:bg-gray-600 dark:text-gray-100"
                  placeholder="Update path (e.g., orders.0.customerId)"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Where to store in extracted JSON
                </p>
              </div>
            </div>
            {responseDataMappings.length > 1 && (
              <button
                type="button"
                onClick={() => removeResponseMapping(index)}
                className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md flex-shrink-0 mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
