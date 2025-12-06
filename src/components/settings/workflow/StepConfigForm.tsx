import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2 } from 'lucide-react';
import Select from '../../common/Select';
import ApiEndpointConfigSection from './ApiEndpointConfigSection';

interface StepConfigFormProps {
  step: any;
  allSteps: any[];
  apiConfig: any;
  onSave: (stepData: any) => void;
  onCancel: () => void;
  extractionType?: any;
}

interface TransformationRule {
  field_name: string;
  transformation: string;
}

export default function StepConfigForm({ step, allSteps, apiConfig, onSave, onCancel, extractionType }: StepConfigFormProps) {
  const [stepName, setStepName] = useState(step?.stepName || step?.step_name || 'New Step');
  const [stepType, setStepType] = useState(step?.stepType || step?.step_type || 'api_call');
  const [method, setMethod] = useState('POST');
  const [url, setUrl] = useState('https://api.example.com/endpoint');
  const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer YOUR_TOKEN_HERE"\n}');
  const [requestBody, setRequestBody] = useState('');
  const [transformations, setTransformations] = useState<TransformationRule[]>([
    { field_name: '', transformation: '' }
  ]);
  const [sftpPath, setSftpPath] = useState('/uploads/xml/');
  const [conditionalField, setConditionalField] = useState('');
  const [conditionalOperator, setConditionalOperator] = useState('equals');
  const [conditionalValue, setConditionalValue] = useState('');
  const [emailActionType, setEmailActionType] = useState('send_email');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [includeAttachment, setIncludeAttachment] = useState(true);
  const [attachmentSource, setAttachmentSource] = useState('original_pdf');
  const [emailFrom, setEmailFrom] = useState('');
  const [pdfEmailStrategy, setPdfEmailStrategy] = useState<'all_pages_in_group' | 'specific_page_in_group'>('all_pages_in_group');
  const [specificPageToEmail, setSpecificPageToEmail] = useState(1);
  const [ccUser, setCcUser] = useState(false);
  const [nextStepOnSuccess, setNextStepOnSuccess] = useState('');
  const [nextStepOnFailure, setNextStepOnFailure] = useState('');
  const [responseDataMappings, setResponseDataMappings] = useState<Array<{ responsePath: string; updatePath: string }>>([
    { responsePath: '', updatePath: '' }
  ]);
  const [useApiResponseForFilename, setUseApiResponseForFilename] = useState(false);
  const [filenameSourcePath, setFilenameSourcePath] = useState('');
  const [fallbackFilename, setFallbackFilename] = useState('');
  const [sftpPathOverride, setSftpPathOverride] = useState('');
  const [renamePdfTemplate, setRenamePdfTemplate] = useState('');
  const [useExtractedDataForRename, setUseExtractedDataForRename] = useState(true);
  const [renameFallbackFilename, setRenameFallbackFilename] = useState('');
  const [appendTimestamp, setAppendTimestamp] = useState(false);
  const [timestampFormat, setTimestampFormat] = useState('YYYYMMDD');
  const [renameFileTypes, setRenameFileTypes] = useState({
    pdf: true,
    csv: false,
    json: false,
    xml: false
  });
  const [pdfUploadStrategy, setPdfUploadStrategy] = useState<'all_pages_in_group' | 'specific_page_in_group'>('all_pages_in_group');
  const [specificPageToUpload, setSpecificPageToUpload] = useState(1);
  const [uploadFileTypes, setUploadFileTypes] = useState({
    json: true,
    pdf: true,
    xml: true,
    csv: true
  });
  const [uploadType, setUploadType] = useState('csv');
  const [escapeSingleQuotesInBody, setEscapeSingleQuotesInBody] = useState(false);
  const [apiEndpointConfig, setApiEndpointConfig] = useState<any>({});

  useEffect(() => {
    console.log('StepConfigForm useEffect - step data:', step);

    // Set basic step properties
    if (step) {
      setStepName(step.stepName || step.step_name || 'New Step');
      setStepType(step.stepType || step.step_type || 'api_call');
      setNextStepOnSuccess(step.nextStepOnSuccessId || step.next_step_on_success_id || '');
      setNextStepOnFailure(step.nextStepOnFailureId || step.next_step_on_failure_id || '');

      // Load configuration from step.configJson or step.config_json
      const config = step.configJson || step.config_json;
      console.log('Loading config from step:', config);

      if (config) {
        // API Call configuration
        setMethod(config.method || 'POST');
        setUrl(config.url || 'https://api.example.com/endpoint');

        // Pre-fill headers with API config token if available
        if (config.headers) {
          setHeaders(JSON.stringify(config.headers, null, 2));
        } else {
          // Create default headers with actual API token if available
          const defaultHeaders = {
            "Content-Type": "application/json",
            "Authorization": apiConfig?.password ? `Bearer ${apiConfig.password}` : "Bearer YOUR_TOKEN_HERE"
          };
          setHeaders(JSON.stringify(defaultHeaders, null, 2));
        }

        setRequestBody(config.requestBody || config.request_body || '');
        setEscapeSingleQuotesInBody(config.escapeSingleQuotesInBody || false);

        // API Call response handling configuration - support both old and new formats
        if (config.responseDataMappings && Array.isArray(config.responseDataMappings)) {
          setResponseDataMappings(config.responseDataMappings);
        } else if (config.responseDataPath || config.updateJsonPath) {
          setResponseDataMappings([{
            responsePath: config.responseDataPath || '',
            updatePath: config.updateJsonPath || ''
          }]);
        } else {
          setResponseDataMappings([{ responsePath: '', updatePath: '' }]);
        }

        // SFTP Upload configuration
        setUseApiResponseForFilename(config.useApiResponseForFilename || false);
        setFilenameSourcePath(config.filenameSourcePath || '');
        setFallbackFilename(config.fallbackFilename || '');
        setSftpPathOverride(config.sftpPathOverride || '');
        setPdfUploadStrategy(config.pdfUploadStrategy || 'all_pages_in_group');
        setSpecificPageToUpload(config.specificPageToUpload || 1);
        setUploadFileTypes(config.uploadFileTypes || { json: true, pdf: true, xml: true, csv: true });
        setUploadType(config.uploadType || 'csv');

        // Rename File configuration
        setRenamePdfTemplate(config.filenameTemplate || config.template || '');
        setUseExtractedDataForRename(config.useExtractedData !== false);
        setRenameFallbackFilename(config.fallbackFilename || '');
        setAppendTimestamp(config.appendTimestamp || false);
        setTimestampFormat(config.timestampFormat || 'YYYYMMDD');
        setRenameFileTypes({
          pdf: config.renamePdf !== false,
          csv: config.renameCsv === true,
          json: config.renameJson === true,
          xml: config.renameXml === true
        });

        // Data Transform configuration
        setTransformations(config.transformations || [{ field_name: '', transformation: '' }]);

        // SFTP Upload configuration
        setSftpPath(config.sftpPath || config.sftp_path || '/uploads/xml/');

        // Conditional Check configuration - support both old and new field names
        setConditionalField(config.jsonPath || config.fieldPath || config.checkField || config.conditional_field || '');
        setConditionalOperator(config.conditionType || config.operator || config.conditional_operator || 'equals');
        setConditionalValue(config.expectedValue || config.conditional_value || '');

        // Email Action configuration
        setEmailActionType(config.actionType || 'send_email');
        setEmailTo(config.to || '');
        setEmailSubject(config.subject || '');
        setEmailBody(config.body || '');
        setIncludeAttachment(config.includeAttachment !== false);
        setAttachmentSource(config.attachmentSource || 'original_pdf');
        setEmailFrom(config.from || '');
        setPdfEmailStrategy(config.pdfEmailStrategy || 'all_pages_in_group');
        setSpecificPageToEmail(config.specificPageToEmail || 1);
        setCcUser(config.ccUser || false);

        // API Endpoint configuration
        if (step?.stepType === 'api_endpoint' || step?.step_type === 'api_endpoint') {
          setApiEndpointConfig(config);
        }
      } else {
        console.log('No configJson found in step, using defaults');

        // Set default headers for new API call steps
        if (step?.stepType === 'api_call' || step?.step_type === 'api_call') {
          const defaultHeaders = {
            "Content-Type": "application/json",
            "Authorization": apiConfig?.password ? `Bearer ${apiConfig.password}` : "Bearer YOUR_TOKEN_HERE"
          };
          setHeaders(JSON.stringify(defaultHeaders, null, 2));
        }
      }
    }
  }, [step, apiConfig?.password]);


  const addTransformation = () => {
    setTransformations([...transformations, { field_name: '', transformation: '' }]);
  };

  const removeTransformation = (index: number) => {
    setTransformations(transformations.filter((_, i) => i !== index));
  };

  const updateTransformation = (index: number, field: keyof TransformationRule, value: string) => {
    const updated = [...transformations];
    updated[index][field] = value;
    setTransformations(updated);
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

  const handleSave = () => {
    let config: any = {};

    switch (stepType) {
      case 'api_call':
        let parsedHeaders = {};
        try {
          parsedHeaders = JSON.parse(headers);
        } catch (e) {
          console.error('Invalid JSON in headers:', e);
          parsedHeaders = {};
        }
        config = {
          method,
          url,
          headers: parsedHeaders,
          requestBody: method === 'GET' ? '' : requestBody,
          responseDataMappings: responseDataMappings.filter(m => m.responsePath || m.updatePath).length > 0
            ? responseDataMappings.filter(m => m.responsePath && m.updatePath)
            : undefined,
          escapeSingleQuotesInBody: escapeSingleQuotesInBody
        };
        console.log('Saving API call config:', config);
        break;
      case 'api_endpoint':
        config = apiEndpointConfig;
        console.log('Saving API endpoint config:', config);
        break;
      case 'data_transform':
        config = {
          transformations: transformations.filter(t => t.field_name && t.transformation)
        };
        break;
      case 'sftp_upload':
        config = {
          uploadType: uploadType,
          useApiResponseForFilename: useApiResponseForFilename,
          filenameSourcePath: filenameSourcePath.trim() || undefined,
          fallbackFilename: fallbackFilename.trim() || undefined,
          sftpPathOverride: sftpPathOverride.trim() || undefined,
          pdfUploadStrategy: pdfUploadStrategy,
          specificPageToUpload: pdfUploadStrategy === 'specific_page_in_group' ? specificPageToUpload : undefined,
          uploadFileTypes: uploadFileTypes
        };
        break;
      case 'conditional_check':
        config = {
          // Save both naming conventions for backward compatibility
          jsonPath: conditionalField,
          fieldPath: conditionalField,
          conditionType: conditionalOperator,
          operator: conditionalOperator,
          expectedValue: conditionalValue
        };
        break;
      case 'rename_file':
      case 'rename_pdf':
        config = {
          filenameTemplate: renamePdfTemplate,
          useExtractedData: useExtractedDataForRename,
          fallbackFilename: renameFallbackFilename.trim() || undefined,
          appendTimestamp: appendTimestamp,
          timestampFormat: appendTimestamp ? timestampFormat : undefined,
          renamePdf: renameFileTypes.pdf,
          renameCsv: renameFileTypes.csv,
          renameJson: renameFileTypes.json,
          renameXml: renameFileTypes.xml
        };
        break;
      case 'email_action':
        config = {
          actionType: emailActionType,
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
          includeAttachment: includeAttachment,
          attachmentSource: attachmentSource,
          from: emailFrom,
          pdfEmailStrategy: pdfEmailStrategy,
          specificPageToEmail: pdfEmailStrategy === 'specific_page_in_group' ? specificPageToEmail : undefined,
          ccUser: ccUser
        };
        break;
    }

    const stepData = {
      id: step?.id || `temp-${Date.now()}`, // Preserve existing ID or create new one
      workflowId: step?.workflowId || '',
      stepOrder: step?.stepOrder || 1,
      stepName: stepName,
      stepType: stepType,
      configJson: config,
      nextStepOnSuccessId: nextStepOnSuccess || undefined,
      nextStepOnFailureId: nextStepOnFailure || undefined,
      escapeSingleQuotesInBody: escapeSingleQuotesInBody
    };

    onSave(stepData);
  };

  const availableSteps = allSteps.filter(s => s.id !== step?.id);

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Add New Step</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Configure step behavior and parameters</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Step Name
              </label>
              <input
                type="text"
                value={stepName}
                onChange={(e) => setStepName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                placeholder="New Step"
              />
            </div>

            <div>
              <Select
                label="Step Type"
                value={stepType}
                onValueChange={setStepType}
                options={[
                  { value: 'api_call', label: 'API Call' },
                  { value: 'api_endpoint', label: 'API Endpoint' },
                  { value: 'conditional_check', label: 'Conditional Check' },
                  { value: 'data_transform', label: 'Data Transform' },
                  { value: 'email_action', label: 'Email Action' },
                  { value: 'rename_file', label: 'Rename File' },
                  { value: 'sftp_upload', label: 'SFTP Upload' }
                ]}
                searchable={false}
              />
            </div>
          </div>

          {/* Method field for API calls - shown in top row */}
          {stepType === 'api_call' && (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
              <div>
                <Select
                  label="HTTP Method"
                  value={method}
                  onValueChange={setMethod}
                  options={[
                    { value: 'POST', label: 'POST' },
                    { value: 'PUT', label: 'PUT' },
                    { value: 'PATCH', label: 'PATCH' },
                    { value: 'GET', label: 'GET' }
                  ]}
                  searchable={false}
                />
              </div>
            </div>
          )}

          {/* PDF Upload Strategy - Show for SFTP Upload steps */}
          {stepType === 'sftp_upload' && (
            <div className="mb-6">
              <h6 className="font-medium text-gray-700 dark:text-gray-300 mb-4">PDF Upload Strategy</h6>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Select
                    label="Upload Strategy"
                    value={pdfUploadStrategy}
                    onValueChange={(value) => setPdfUploadStrategy(value as 'all_pages_in_group' | 'specific_page_in_group')}
                    options={[
                      { value: 'all_pages_in_group', label: 'Upload All Pages in Group' },
                      { value: 'specific_page_in_group', label: 'Upload Specific Page Only' }
                    ]}
                    searchable={false}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Choose whether to upload the entire grouped PDF or just a specific page from the group
                  </p>
                </div>

                {pdfUploadStrategy === 'specific_page_in_group' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Specific Page to Upload
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={specificPageToUpload}
                      onChange={(e) => setSpecificPageToUpload(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="2"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Page number within the group to upload (e.g., 2 for the second page in a 2-page group)
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">Step Configuration</h4>
            
            {stepType === 'api_call' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL
                  </label>
                  <textarea
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100"
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Headers (JSON format)
                  </label>
                  <textarea
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Request Body Template
                  </label>
                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Leave empty for GET requests, or enter JSON for POST/PUT requests"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use {`{{field_name}}`} to reference extracted data. Leave empty for GET requests.
                  </p>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                  <input
                    type="checkbox"
                    id="escapeSingleQuotesInBody"
                    checked={escapeSingleQuotesInBody}
                    onChange={(e) => setEscapeSingleQuotesInBody(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="escapeSingleQuotesInBody" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                      Escape Single Quotes for OData Filters
                    </label>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Enable this when using OData $filter syntax. Converts single quotes to double quotes (e.g., "O'Hare" becomes "O''Hare") in all placeholder values in the URL and request body.
                    </p>
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
                      className="flex items-center px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm dark:bg-gray-600 dark:text-gray-100"
                            placeholder="Response path (e.g., clients[0].clientId)"
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
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm dark:bg-gray-600 dark:text-gray-100"
                            placeholder="Update path (e.g., orders.0.consignee.clientId)"
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
            )}

            {stepType === 'api_endpoint' && (
              <ApiEndpointConfigSection
                config={apiEndpointConfig}
                onChange={setApiEndpointConfig}
                allSteps={allSteps}
                currentStepOrder={step?.stepOrder || step?.step_order}
                extractionType={extractionType}
              />
            )}

            {stepType === 'data_transform' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Data Transformations
                  </label>
                  <button
                    onClick={addTransformation}
                    className="flex items-center px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Rule
                  </button>
                </div>
                
                {transformations.map((transformation, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <input
                      type="text"
                      value={transformation.field_name}
                      onChange={(e) => updateTransformation(index, 'field_name', e.target.value)}
                      placeholder="Field name"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-600 dark:text-gray-100"
                    />
                    <input
                      type="text"
                      value={transformation.transformation}
                      onChange={(e) => updateTransformation(index, 'transformation', e.target.value)}
                      placeholder="Transformation rule"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-600 dark:text-gray-100"
                    />
                    {transformations.length > 1 && (
                      <button
                        onClick={() => removeTransformation(index)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {stepType === 'sftp_upload' && (
              <div className="space-y-4">
                <div>
                  <Select
                    label="Upload Type"
                    value={uploadType}
                    onValueChange={setUploadType}
                    options={[
                      { value: 'csv', label: 'CSV File' },
                      { value: 'json', label: 'JSON File' },
                      { value: 'xml', label: 'XML File' },
                      { value: 'pdf', label: 'PDF File' }
                    ]}
                    required
                    searchable={false}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Select the type of file to upload to SFTP. The default SFTP configuration from Settings will be used.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    File Types to Upload
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="uploadJson"
                        checked={uploadFileTypes.json}
                        onChange={(e) => setUploadFileTypes({ ...uploadFileTypes, json: e.target.checked })}
                        className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="uploadJson" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        JSON
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="uploadPdf"
                        checked={uploadFileTypes.pdf}
                        onChange={(e) => setUploadFileTypes({ ...uploadFileTypes, pdf: e.target.checked })}
                        className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="uploadPdf" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        PDF
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="uploadXml"
                        checked={uploadFileTypes.xml}
                        onChange={(e) => setUploadFileTypes({ ...uploadFileTypes, xml: e.target.checked })}
                        className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="uploadXml" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        XML
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="uploadCsv"
                        checked={uploadFileTypes.csv}
                        onChange={(e) => setUploadFileTypes({ ...uploadFileTypes, csv: e.target.checked })}
                        className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-600 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="uploadCsv" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        CSV
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Select which file types to upload to the SFTP server. At least one type must be selected.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    SFTP Path Override (Optional)
                  </label>
                  <input
                    type="text"
                    value={sftpPathOverride}
                    onChange={(e) => setSftpPathOverride(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="e.g., /custom/upload/path/ or leave empty for default"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Override the default SFTP upload path from settings. Leave empty to use default SFTP configuration.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="useApiResponseForFilename"
                    checked={useApiResponseForFilename}
                    onChange={(e) => setUseApiResponseForFilename(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="useApiResponseForFilename" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Use API response for filename
                  </label>
                </div>

                {useApiResponseForFilename && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Filename Source Path
                    </label>
                    <input
                      type="text"
                      value={filenameSourcePath}
                      onChange={(e) => setFilenameSourcePath(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100"
                      placeholder="e.g., billNumber or orders.0.billNumber"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      JSON path to extract filename from API response or extracted data
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fallback Filename
                  </label>
                  <input
                    type="text"
                    value={fallbackFilename}
                    onChange={(e) => setFallbackFilename(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="e.g., BL_ or document"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Default filename to use if custom filename cannot be determined
                  </p>
                </div>
              </div>
            )}

            {stepType === 'conditional_check' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    JSON Path to Check
                  </label>
                  <input
                    type="text"
                    value={conditionalField}
                    onChange={(e) => setConditionalField(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="orders.0.status"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Select
                      label="Condition Type"
                      value={conditionalOperator}
                      onValueChange={setConditionalOperator}
                      options={[
                        { value: 'equals', label: 'Equals' },
                        { value: 'is_null', label: 'Is Null' },
                        { value: 'is_not_null', label: 'Is Not Null' },
                        { value: 'contains', label: 'Contains' },
                        { value: 'greater_than', label: 'Greater Than' },
                        { value: 'less_than', label: 'Less Than' }
                      ]}
                      searchable={false}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expected Value
                    </label>
                    <input
                      type="text"
                      value={conditionalValue}
                      onChange={(e) => setConditionalValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="active"
                    />
                  </div>
                </div>
              </div>
            )}

            {(stepType === 'rename_file' || stepType === 'rename_pdf') && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Filename Template
                  </label>
                  <input
                    type="text"
                    value={renamePdfTemplate}
                    onChange={(e) => setRenamePdfTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="e.g., {{invoiceNumber}}_{{customerName}} or BL_{{billNumber}}"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use {`{{fieldName}}`} to reference extracted data. <strong>DO NOT include file extension</strong> - it will be added automatically based on selected file types (.pdf, .csv, .json, .xml).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    File Types to Rename
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <input
                        type="checkbox"
                        id="renamePdf"
                        checked={renameFileTypes.pdf}
                        onChange={(e) => setRenameFileTypes({ ...renameFileTypes, pdf: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="renamePdf" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        PDF (.pdf)
                      </label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <input
                        type="checkbox"
                        id="renameCsv"
                        checked={renameFileTypes.csv}
                        onChange={(e) => setRenameFileTypes({ ...renameFileTypes, csv: e.target.checked })}
                        className="w-4 h-4 text-green-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-green-500"
                      />
                      <label htmlFor="renameCsv" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        CSV (.csv)
                      </label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <input
                        type="checkbox"
                        id="renameJson"
                        checked={renameFileTypes.json}
                        onChange={(e) => setRenameFileTypes({ ...renameFileTypes, json: e.target.checked })}
                        className="w-4 h-4 text-orange-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-orange-500"
                      />
                      <label htmlFor="renameJson" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        JSON (.json)
                      </label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <input
                        type="checkbox"
                        id="renameXml"
                        checked={renameFileTypes.xml}
                        onChange={(e) => setRenameFileTypes({ ...renameFileTypes, xml: e.target.checked })}
                        className="w-4 h-4 text-red-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-red-500"
                      />
                      <label htmlFor="renameXml" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        XML (.xml)
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Select which file types to rename. The same template will be used for all selected types with the appropriate extension added automatically.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="useExtractedDataForRename"
                    checked={useExtractedDataForRename}
                    onChange={(e) => setUseExtractedDataForRename(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="useExtractedDataForRename" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Use extracted data for filename
                  </label>
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="appendTimestamp"
                    checked={appendTimestamp}
                    onChange={(e) => setAppendTimestamp(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="appendTimestamp" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Append Timestamp to Filename
                  </label>
                </div>

                {appendTimestamp && (
                  <div>
                    <Select
                      label="Timestamp Format"
                      value={timestampFormat}
                      onValueChange={setTimestampFormat}
                      options={[
                        { value: 'YYYYMMDD', label: 'YYYYMMDD (e.g., 20250116)' },
                        { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g., 2025-01-16)' },
                        { value: 'YYYYMMDD_HHMMSS', label: 'YYYYMMDD_HHMMSS (e.g., 20250116_143022)' },
                        { value: 'YYYY-MM-DD_HH-MM-SS', label: 'YYYY-MM-DD_HH-MM-SS (e.g., 2025-01-16_14-30-22)' }
                      ]}
                      searchable={false}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Timestamp will be inserted before the file extension (e.g., invoice_20250116.pdf)
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Fallback Filename
                  </label>
                  <input
                    type="text"
                    value={renameFallbackFilename}
                    onChange={(e) => setRenameFallbackFilename(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="e.g., document or processed_file"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Default filename to use if template cannot be processed or extracted data is missing
                  </p>
                </div>
              </div>
            )}

            {stepType === 'email_action' && (
              <div className="space-y-4">
                <div>
                  <Select
                    label="Email Action Type"
                    value={emailActionType}
                    onValueChange={setEmailActionType}
                    options={[
                      { value: 'send_email', label: 'Send Email' },
                      { value: 'archive_email', label: 'Archive Email' }
                    ]}
                    searchable={false}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      To (Email Address)
                    </label>
                    <input
                      type="email"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="recipient@example.com or {{customerEmail}}"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use {`{{fieldName}}`} to reference extracted data
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      From (Optional)
                    </label>
                    <input
                      type="email"
                      value={emailFrom}
                      onChange={(e) => setEmailFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="sender@example.com"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Leave empty to use default sender
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 mt-4">
                  <input
                    type="checkbox"
                    id="ccUser"
                    checked={ccUser}
                    onChange={(e) => setCcUser(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="ccUser" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    CC User
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">
                  CC the current user who submitted the transform (requires email in Users table)
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Your document has been processed - {{invoiceNumber}}"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use {`{{fieldName}}`} to reference extracted data
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Body
                  </label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Dear {{customerName}},&#10;&#10;Your document {{invoiceNumber}} has been processed successfully.&#10;&#10;Please find the attached PDF for your records.&#10;&#10;Best regards,&#10;Parse-It System"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Use {`{{fieldName}}`} to reference extracted data. Use &#10; for line breaks.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="includeAttachment"
                      checked={includeAttachment}
                      onChange={(e) => setIncludeAttachment(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="includeAttachment" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Include PDF attachment
                    </label>
                  </div>

                  {includeAttachment && (
                    <div>
                      <Select
                        label="Attachment Source"
                        value={attachmentSource}
                        onValueChange={setAttachmentSource}
                        options={[
                          { value: 'original_pdf', label: 'Original PDF' },
                          { value: 'extraction_type_filename', label: 'Extraction Type Filename' },
                          { value: 'renamed_pdf', label: 'Renamed PDF (from previous step)' }
                        ]}
                        searchable={false}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Choose whether to attach the original PDF, use the extraction type's filename template, or a renamed version from a previous workflow step
                      </p>
                    </div>
                  )}
                </div>

                {includeAttachment && (
                  <div className="mt-4">
                    <h6 className="font-medium text-gray-700 dark:text-gray-300 mb-4">PDF Attachment Strategy</h6>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Select
                          label="Attachment Strategy"
                          value={pdfEmailStrategy}
                          onValueChange={(value) => setPdfEmailStrategy(value as 'all_pages_in_group' | 'specific_page_in_group')}
                          options={[
                            { value: 'all_pages_in_group', label: 'Attach All Pages in Group' },
                            { value: 'specific_page_in_group', label: 'Attach Specific Page Only' }
                          ]}
                          searchable={false}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Choose whether to attach the entire grouped PDF or just a specific page from the group
                        </p>
                      </div>

                      {pdfEmailStrategy === 'specific_page_in_group' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Specific Page to Attach
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={specificPageToEmail}
                            onChange={(e) => setSpecificPageToEmail(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                            placeholder="2"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Page number within the group to attach (e.g., 2 for the second page in a 2-page group)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Select
                label="Next Step on Success"
                value={nextStepOnSuccess || '__none__'}
                onValueChange={(value) => setNextStepOnSuccess(value === '__none__' ? '' : value)}
                options={[
                  { value: '__none__', label: 'End workflow' },
                  ...availableSteps.map((s) => ({
                    value: s.id,
                    label: s.stepName || s.step_name
                  }))
                ]}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Step to execute if this step succeeds
              </p>
            </div>

            <div>
              <Select
                label="Next Step on Failure"
                value={nextStepOnFailure || '__none__'}
                onValueChange={(value) => setNextStepOnFailure(value === '__none__' ? '' : value)}
                options={[
                  { value: '__none__', label: 'End workflow' },
                  ...availableSteps.map((s) => ({
                    value: s.id,
                    label: s.stepName || s.step_name
                  }))
                ]}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Step to execute if this step fails
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Save Step
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}