import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import type { WorkflowStep, ApiCallConfig, ConditionalCheckConfig, DataTransformConfig, ApiConfig } from '../../../types';

interface StepConfigFormProps {
  step: WorkflowStep;
  allSteps: WorkflowStep[];
  apiConfig: ApiConfig;
  onSave: (step: WorkflowStep) => void;
  onCancel: () => void;
}

export default function StepConfigForm({ step, allSteps, apiConfig, onSave, onCancel }: StepConfigFormProps) {
  const [localStep, setLocalStep] = useState<WorkflowStep>(step);

  // Auto-populate Authorization header for API call steps
  React.useEffect(() => {
    if (localStep.stepType === 'api_call' && apiConfig.password) {
      const config = localStep.configJson as ApiCallConfig;
      const currentHeaders = config.headers || {};
      
      // Only set Authorization header if it's not already set
      if (!currentHeaders.Authorization) {
        const updatedHeaders = {
          ...currentHeaders,
          'Content-Type': 'application/json'
          // Note: Authorization header should be manually configured for each API endpoint
        };
        
        setLocalStep(prev => ({
          ...prev,
          configJson: {
            ...config,
            headers: updatedHeaders
          }
        }));
      }
    }
  }, [localStep.stepType, apiConfig.password]);

  const handleSave = () => {
    // Ensure configJson is never undefined
    if (!localStep.configJson) {
      localStep.configJson = {};
    }
    
    console.log('Saving step with config:', localStep);
    onSave(localStep);
  };

  const updateStep = (field: keyof WorkflowStep, value: any) => {
    setLocalStep(prev => ({ ...prev, [field]: value }));
  };

  const updateConfig = (config: any) => {
    setLocalStep(prev => ({ ...prev, configJson: config }));
  };

  const renderApiCallConfig = () => {
    const config: ApiCallConfig = localStep.configJson as ApiCallConfig;
    
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL
          </label>
          <textarea
            value={config.url || ''}
            onChange={(e) => updateConfig({ ...config, url: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            rows={3}
            placeholder="https://api.example.com/endpoint"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Headers (JSON format)
          </label>
          <textarea
            value={config.headers ? JSON.stringify(config.headers, null, 2) : JSON.stringify({
              "Content-Type": "application/json",
              "Authorization": "Bearer YOUR_TRUCKMATE_TOKEN_HERE"
            }, null, 2)}
            onChange={(e) => {
              try {
                const headers = JSON.parse(e.target.value);
                updateConfig({ ...config, headers });
              } catch (error) {
                // Invalid JSON, keep the text as is for user to fix
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            rows={3}
            placeholder='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_TRUCKMATE_TOKEN_HERE"}'
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Request Body Template
          </label>
          <textarea
            value={config.requestBody || ''}
            onChange={(e) => updateConfig({ ...config, requestBody: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            rows={4}
            placeholder="Use {{field_name}} to reference extracted data"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Response Data Path
            </label>
            <input
              type="text"
              value={config.responseDataPath || ''}
              onChange={(e) => updateConfig({ ...config, responseDataPath: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="response.data.id"
            />
            <p className="text-xs text-gray-500 mt-1">JSON path to extract data from API response</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Update JSON Path
            </label>
            <input
              type="text"
              value={config.updateJsonPath || ''}
              onChange={(e) => updateConfig({ ...config, updateJsonPath: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="orders.0.apiId"
            />
            <p className="text-xs text-gray-500 mt-1">Where to store the response data in extracted JSON</p>
          </div>
        </div>
      </div>
    );
  };

  const renderConditionalCheckConfig = () => {
    const config: ConditionalCheckConfig = localStep.configJson as ConditionalCheckConfig;
    
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            JSON Path to Check
          </label>
          <input
            type="text"
            value={config.jsonPath || ''}
            onChange={(e) => updateConfig({ ...config, jsonPath: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="orders.0.status"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Condition Type
            </label>
            <select
              value={config.conditionType || 'equals'}
              onChange={(e) => updateConfig({ ...config, conditionType: e.target.value as ConditionalCheckConfig['conditionType'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="is_null">Is Null</option>
              <option value="is_not_null">Is Not Null</option>
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="greater_than">Greater Than</option>
              <option value="less_than">Less Than</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expected Value
            </label>
            <input
              type="text"
              value={config.expectedValue || ''}
              onChange={(e) => updateConfig({ ...config, expectedValue: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="active"
              disabled={config.conditionType === 'is_null' || config.conditionType === 'is_not_null'}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Next Step on Success
            </label>
            <select
              value={localStep.nextStepOnSuccessId || ''}
              onChange={(e) => updateStep('nextStepOnSuccessId', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Continue to next step</option>
              {allSteps
                .filter(s => s.id !== localStep.id)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    Step {s.stepOrder}: {s.stepName}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Next Step on Failure
            </label>
            <select
              value={localStep.nextStepOnFailureId || ''}
              onChange={(e) => updateStep('nextStepOnFailureId', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Stop workflow</option>
              {allSteps
                .filter(s => s.id !== localStep.id)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    Step {s.stepOrder}: {s.stepName}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  const renderDataTransformConfig = () => {
    const config: DataTransformConfig = localStep.configJson as DataTransformConfig;
    const transformations = config.transformations || [];
    
    const addTransformation = () => {
      const newTransformations = [...transformations, {
        jsonPath: '',
        operation: 'set_value' as const,
        value: ''
      }];
      updateConfig({ ...config, transformations: newTransformations });
    };
    
    const updateTransformation = (index: number, field: string, value: any) => {
      const newTransformations = [...transformations];
      newTransformations[index] = { ...newTransformations[index], [field]: value };
      updateConfig({ ...config, transformations: newTransformations });
    };
    
    const removeTransformation = (index: number) => {
      const newTransformations = transformations.filter((_, i) => i !== index);
      updateConfig({ ...config, transformations: newTransformations });
    };
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Data Transformations
          </label>
          <button
            type="button"
            onClick={addTransformation}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors duration-200"
          >
            Add Transformation
          </button>
        </div>
        
        <div className="space-y-3">
          {transformations.map((transformation, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    JSON Path
                  </label>
                  <input
                    type="text"
                    value={transformation.jsonPath}
                    onChange={(e) => updateTransformation(index, 'jsonPath', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="orders.0.status"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Operation
                  </label>
                  <select
                    value={transformation.operation}
                    onChange={(e) => updateTransformation(index, 'operation', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="set_value">Set Value</option>
                    <option value="copy_from">Copy From</option>
                    <option value="append">Append</option>
                    <option value="remove">Remove</option>
                    <option value="format_phone_us">Format US Phone Number</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {transformation.operation === 'copy_from' ? 'Source Path' : 'Value'}
                  </label>
                  <input
                    type="text"
                    value={transformation.operation === 'copy_from' ? transformation.sourceJsonPath || '' : transformation.value || ''}
                    onChange={(e) => {
                      if (transformation.operation === 'copy_from') {
                        updateTransformation(index, 'sourceJsonPath', e.target.value);
                      } else {
                        updateTransformation(index, 'value', e.target.value);
                      }
                    }}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder={transformation.operation === 'copy_from' ? 'source.field' : 'new value'}
                    disabled={transformation.operation === 'remove' || transformation.operation === 'format_phone_us'}
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => removeTransformation(index)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {transformations.length === 0 && (
          <div className="text-center py-4 text-gray-500 text-sm">
            No transformations defined. Click "Add Transformation" to get started.
          </div>
        )}
      </div>
    );
  };

  const renderSftpUploadConfig = () => {
    const config = localStep.configJson as any;
    
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="useApiResponseForFilename"
            checked={config.useApiResponseForFilename || false}
            onChange={(e) => updateConfig({ ...config, useApiResponseForFilename: e.target.checked })}
            className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
          />
          <label htmlFor="useApiResponseForFilename" className="text-sm font-medium text-gray-700">
            Use API response for filename
          </label>
        </div>
        
        {config.useApiResponseForFilename && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filename Source Path
            </label>
            <input
              type="text"
              value={config.filenameSourcePath || ''}
              onChange={(e) => updateConfig({ ...config, filenameSourcePath: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="billNumber or orders.0.billNumber"
            />
            <p className="text-xs text-gray-500 mt-1">
              JSON path to extract filename from API response or extracted data
            </p>
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fallback Filename
          </label>
          <input
            type="text"
            value={config.fallbackFilename || ''}
            onChange={(e) => updateConfig({ ...config, fallbackFilename: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="document"
          />
          <p className="text-xs text-gray-500 mt-1">
            Default filename to use if custom filename cannot be determined
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {step.id.startsWith('temp-') ? 'Add New Step' : 'Edit Step'}
            </h3>
            <p className="text-sm text-purple-100 mt-1">Configure step behavior and parameters</p>
          </div>
          <button
            onClick={onCancel}
            className="text-white/70 hover:text-white transition-colors duration-200 p-1 rounded-lg hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Step Info */}
            <div>
              <div className="grid grid-cols-8 gap-4">
                <div className="col-span-5">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Step Name
                  </label>
                  <input
                    type="text"
                    value={localStep.stepName}
                    onChange={(e) => updateStep('stepName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Descriptive step name"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Step Type
                  </label>
                  <select
                    value={localStep.stepType}
                    onChange={(e) => {
                      updateStep('stepType', e.target.value);
                      updateConfig({}); // Reset config when type changes
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="api_call">API Call</option>
                    <option value="conditional_check">Conditional Check</option>
                    <option value="data_transform">Data Transform</option>
                    <option value="sftp_upload">SFTP Upload</option>
                    <option value="sftp_upload">SFTP Upload</option>
                  </select>
                </div>
                {localStep.stepType === 'api_call' ? (
                  <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Method
                    </label>
                    <select
                      value={(localStep.configJson as ApiCallConfig).method || 'POST'}
                      onChange={(e) => updateConfig({ ...(localStep.configJson as ApiCallConfig), method: e.target.value as 'GET' | 'POST' | 'PUT' | 'DELETE' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                ) : (
                  <div className="md:col-span-1"></div>
                )}
              </div>
            </div>

            {/* Step-specific Configuration */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Step Configuration</h4>
              {localStep.stepType === 'api_call' && renderApiCallConfig()}
              {localStep.stepType === 'conditional_check' && renderConditionalCheckConfig()}
              {localStep.stepType === 'data_transform' && renderDataTransformConfig()}
              {localStep.stepType === 'sftp_upload' && renderSftpUploadConfig()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>Save Step</span>
          </button>
        </div>
      </div>
    </div>
  );
}