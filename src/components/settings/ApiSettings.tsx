import React, { useState } from 'react';
import { Save, Key, Globe, TestTube, Database, Eye, Plus, Trash2 } from 'lucide-react';
import type { ApiConfig, OrderDisplayMapping } from '../../types';

interface ApiSettingsProps {
  apiConfig: ApiConfig;
  onUpdateApiConfig: (config: ApiConfig) => Promise<void>;
}

export default function ApiSettings({ apiConfig, onUpdateApiConfig }: ApiSettingsProps) {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(apiConfig);
  const [localCustomOrderDisplayFields, setLocalCustomOrderDisplayFields] = useState<OrderDisplayMapping[]>(
    Array.isArray(apiConfig.customOrderDisplayFields) ? apiConfig.customOrderDisplayFields : []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [ordersTestResult, setOrdersTestResult] = useState<{ success: boolean; message: string; orders?: any[]; displayFields?: string[] } | null>(null);
  const [isTestingOrders, setIsTestingOrders] = useState(false);

  const handleAddCustomLabel = () => {
    setLocalCustomOrderDisplayFields(prev => [
      ...prev,
      { fieldName: '', displayLabel: '' }
    ]);
  };

  const handleUpdateCustomLabel = (index: number, field: 'fieldName' | 'displayLabel', value: string) => {
    setLocalCustomOrderDisplayFields(prev => 
      prev.map((mapping, i) => 
        i === index ? { ...mapping, [field]: value } : mapping
      )
    );
  };

  const handleRemoveCustomLabel = (index: number) => {
    setLocalCustomOrderDisplayFields(prev => 
      prev.filter((_, i) => i !== index)
    );
  };

  const updateConfig = (field: keyof ApiConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const configToSave = {
        ...localConfig,
        customOrderDisplayFields: localCustomOrderDisplayFields
      };
      console.log('Saving API config:', configToSave);
      console.log('Order display fields being saved:', localConfig.orderDisplayFields);
      console.log('Custom order display fields being saved:', localCustomOrderDisplayFields);
      await onUpdateApiConfig(configToSave);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save API config:', error);
      alert('Failed to save API configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestOrdersDisplay = async () => {
    setIsTestingOrders(true);
    setOrdersTestResult(null);
    
    try {
      if (!localConfig.path) {
        setOrdersTestResult({
          success: false,
          message: 'Please enter a Base API Path first'
        });
        return;
      }

      // Parse display fields
      let displayFields: string[] = ['orderId', 'opCode'];
      try {
        if (localConfig.orderDisplayFields) {
          const parsed = JSON.parse(localConfig.orderDisplayFields);
          if (Array.isArray(parsed) && parsed.length > 0) {
            displayFields = parsed;
          }
        }
      } catch (parseError) {
        setOrdersTestResult({
          success: false,
          message: 'Invalid JSON in Order Display Fields. Please check the format.'
        });
        return;
      }

      // Construct the test URL (using a test zone)
      const baseUrl = localConfig.path.endsWith('/') 
        ? localConfig.path.slice(0, -1) 
        : localConfig.path;
      
      const testZone = 'TEST_ZONE';
      
      // Extract top-level fields for $select (convert nested fields like "shipper.name" to just "shipper")
      // Only include $select if we have simple fields (no nested ones)
      const hasNestedFields = displayFields.some(field => field.includes('.'));
      let selectParam = '';
      
      if (!hasNestedFields) {
        // Only use $select for simple fields
        selectParam = `$select=${displayFields.join(',')}&`;
      } else {
        // For nested fields, rely on expand to get the full objects
        console.log('Nested fields detected, skipping $select parameter for preview');
      }
      
      const queryParams = [
        'limit=5', // Limit to 5 for preview
        'offset=0',
        'expand=consignee,shipper',
        'type=T',
        `$filter=status eq 'AGTDOCKED'` // Remove zone filter for test
      ];

      const testUrl = `${baseUrl}/orders?${selectParam}${queryParams.join('&')}`;
      console.log('Testing orders API with URL:', testUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (localConfig.password) {
        headers['Authorization'] = `Bearer ${localConfig.password}`;
      }

      const response = await fetch(testUrl, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const data = await response.json();
        
        // Handle different response formats
        let ordersArray: any[] = [];
        if (Array.isArray(data)) {
          ordersArray = data;
        } else if (data.orders && Array.isArray(data.orders)) {
          ordersArray = data.orders;
        } else if (data.data && Array.isArray(data.data)) {
          ordersArray = data.data;
        } else if (data.value && Array.isArray(data.value)) {
          ordersArray = data.value;
        }

        setOrdersTestResult({
          success: true,
          message: `Successfully fetched ${ordersArray.length} sample orders`,
          orders: ordersArray.slice(0, 5), // Show max 5 for preview
          displayFields,
          customDisplayFields: localCustomOrderDisplayFields
        });
      } else {
        let errorMessage = `API call failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        setOrdersTestResult({
          success: false,
          message: errorMessage
        });
      }
    } catch (error) {
      setOrdersTestResult({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTestingOrders(false);
    }
  };

  const formatFieldValue = (order: any, field: string): string => {
    // Handle nested fields like consignee.name, shipper.city
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const parentObj = order[parent];
      if (parentObj && typeof parentObj === 'object') {
        return parentObj[child] || 'N/A';
      }
      return 'N/A';
    }
    
    // Handle direct fields
    const value = order[field];
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    return String(value);
  };

  const getFieldDisplayName = (field: string): string => {
    // Check for custom display labels first
    const customMapping = localCustomOrderDisplayFields.find(mapping => mapping.fieldName === field);
    if (customMapping && customMapping.displayLabel) {
      return customMapping.displayLabel;
    }
    
    // Fall back to default field names
    const fieldNames: Record<string, string> = {
      'orderId': 'Order ID',
      'opCode': 'Op Code',
      'consignee.name': 'Consignee',
      'consignee.city': 'Consignee City',
      'consignee.state': 'Consignee State',
      'shipper.name': 'Shipper',
      'shipper.city': 'Shipper City',
      'shipper.state': 'Shipper State',
      'status': 'Status',
      'currentZone': 'Current Zone'
    };
    
    return fieldNames[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const handleTestTruckMateApi = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      if (!localConfig.path) {
        setTestResult({
          success: false,
          message: 'Please enter a Base API Path first'
        });
        return;
      }

      const testUrl = localConfig.path.endsWith('/') 
        ? `${localConfig.path.slice(0, -1)}/WHOAMI`
        : `${localConfig.path}/WHOAMI`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (localConfig.password) {
        headers['Authorization'] = `Bearer ${localConfig.password}`;
      }

      const response = await fetch(testUrl, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const responseData = await response.json();
        setTestResult({
          success: true,
          message: 'TruckMate API connection successful!',
          data: responseData
        });
      } else {
        const errorText = await response.text();
        setTestResult({
          success: false,
          message: `API call failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">API Configuration</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure API settings for JSON data transmission</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestTruckMateApi}
            disabled={isTesting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <TestTube className="h-4 w-4" />
            <span>{isTesting ? 'Testing...' : 'Test TruckMate API'}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="font-semibold text-green-800 dark:text-green-300">Success!</span>
          </div>
          <p className="text-green-700 dark:text-green-400 text-sm mt-1">API configuration saved successfully!</p>
        </div>
      )}

      {testResult && (
        <div className={`border rounded-lg p-4 ${
          testResult.success 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-4 h-4 rounded-full ${
              testResult.success ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className={`font-semibold ${
              testResult.success ? 'text-green-800' : 'text-red-800'
            } dark:${testResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {testResult.success ? 'API Test Passed' : 'API Test Failed'}
            </span>
          </div>
          <p className={`text-sm mt-1 ${
            testResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {testResult.message}
          </p>
          {testResult.data && (
            <div className="mt-3 bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">API Response:</p>
              <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {ordersTestResult && (
        <div className={`border rounded-lg p-4 ${
          ordersTestResult.success 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-4 h-4 rounded-full ${
              ordersTestResult.success ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className={`font-semibold ${
              ordersTestResult.success ? 'text-green-800' : 'text-red-800'
            } dark:${ordersTestResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {ordersTestResult.success ? 'Orders Preview Test Passed' : 'Orders Preview Test Failed'}
            </span>
          </div>
          <p className={`text-sm mt-1 ${
            ordersTestResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {ordersTestResult.message}
          </p>
          
          {ordersTestResult.success && ordersTestResult.orders && ordersTestResult.orders.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium text-green-800 dark:text-green-300 mb-3">Preview of Orders Display:</h5>
              <div className="bg-white dark:bg-gray-700 rounded-lg border border-green-200 dark:border-green-600 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                  <thead className="bg-gray-50 dark:bg-gray-600">
                    <tr>
                      {ordersTestResult.displayFields?.map((field) => (
                        <th
                          key={field}
                          className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          {getFieldDisplayName(field)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                    {ordersTestResult.orders.slice(0, 3).map((order, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                        {ordersTestResult.displayFields?.map((field) => (
                          <td key={field} className="px-4 py-2 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-gray-100">
                              {formatFieldValue(order, field)}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Showing first 3 orders. Vendors will see orders filtered by their assigned zone.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {/* API Endpoint Settings */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg">
              <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">API Endpoint</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Base URL for JSON data transmission</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Base API Path
              </label>
              <input
                type="text"
                value={localConfig.path}
                onChange={(e) => updateConfig('path', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="https://api.example.com/v1"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This will be combined with the JSON Path from extraction types
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Password/Token
              </label>
              <input
                type="password"
                value={localConfig.password}
                onChange={(e) => updateConfig('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Bearer token or API key"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Optional: Used as Authorization header
              </p>
            </div>
          </div>
        </div>

        {/* Google Gemini API Settings */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Google Gemini API</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">API key for PDF data extraction</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={localConfig.googleApiKey}
              onChange={(e) => updateConfig('googleApiKey', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your Google Gemini API key"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Get your API key from{' '}
              <a 
                href="https://makersuite.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>
        </div>

        {/* Order Display Fields Configuration */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg">
                <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Orders Display Configuration</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configure which fields vendors see in the Orders dashboard</p>
              </div>
            </div>
            <button
              onClick={handleTestOrdersDisplay}
              disabled={isTestingOrders}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <Eye className="h-4 w-4" />
              <span>{isTestingOrders ? 'Testing...' : 'Preview Orders Display'}</span>
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Order Display Fields (JSON Array)
            </label>
            <textarea
              value={localConfig.orderDisplayFields || ''}
              onChange={(e) => updateConfig('orderDisplayFields', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              rows={6}
              placeholder='["orderId", "opCode", "consignee.name", "consignee.city", "shipper.name", "status"]'
            />
            <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <p><strong>Available Fields:</strong></p>
              <p>• <code>orderId</code>, <code>opCode</code>, <code>status</code>, <code>currentZone</code></p>
              <p>• <code>consignee.name</code>, <code>consignee.city</code>, <code>consignee.state</code></p>
              <p>• <code>shipper.name</code>, <code>shipper.city</code>, <code>shipper.state</code></p>
              <p><strong>Example:</strong> <code>["orderId", "opCode", "consignee.name", "shipper.name", "status"]</code></p>
            </div>
          </div>
        </div>

        {/* Custom Display Labels Configuration */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg">
                <Eye className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Custom Display Labels</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">Customize how field names appear in the Orders grid</p>
              </div>
            </div>
            <button
              onClick={handleAddCustomLabel}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Custom Label</span>
            </button>
          </div>

          <div className="space-y-3">
            {localCustomOrderDisplayFields.map((mapping, index) => (
              <div key={index} className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Original Field Name
                    </label>
                    <input
                      type="text"
                      value={mapping.fieldName}
                      onChange={(e) => handleUpdateCustomLabel(index, 'fieldName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                      placeholder="e.g., consignee.address1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Display Label
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={mapping.displayLabel}
                        onChange={(e) => handleUpdateCustomLabel(index, 'displayLabel', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="e.g., CONS_ADDRESS"
                      />
                      <button
                        onClick={() => handleRemoveCustomLabel(index)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {localCustomOrderDisplayFields.length === 0 && (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                <Eye className="h-8 w-8 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Custom Labels</h4>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Add custom display labels to rename field headers in the Orders grid</p>
                <button
                  onClick={handleAddCustomLabel}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add First Custom Label</span>
                </button>
              </div>
            )}
          </div>
          
          <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-3">
            <h5 className="font-medium text-indigo-800 dark:text-indigo-300 mb-2">How Custom Labels Work</h5>
            <ul className="text-sm text-indigo-700 dark:text-indigo-400 space-y-1">
              <li>• Enter the exact field name from your Order Display Fields (e.g., <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">consignee.address1</code>)</li>
              <li>• Provide a custom label that will appear as the column header (e.g., <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">CONS_ADDRESS</code>)</li>
              <li>• Custom labels override the default field names in the Orders grid</li>
              <li>• Fields without custom labels will use the default display names</li>
            </ul>
          </div>
        </div>

        {/* Usage Information */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">How API Integration Works</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• JSON extraction types will send data to: <code className="bg-blue-100 px-1 rounded">Base API Path + JSON Path</code></li>
            <li>• Data is sent as POST request with JSON body</li>
            <li>• Authorization header is added if API password is provided</li>
            <li>• Google Gemini API is used for PDF data extraction</li>
            <li>• Use "Test TruckMate API" to verify your API connection with /WHOAMI endpoint</li>
            <li>• Use "Preview Orders Display" to test the Orders page configuration and see sample data</li>
            <li>• Custom display labels allow you to rename column headers in the Orders grid</li>
          </ul>
        </div>
      </div>
    </div>
  );
}