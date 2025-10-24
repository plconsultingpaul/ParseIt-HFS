import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface StepConfigFormProps {
  step: any;
  allSteps: any[];
  apiConfig: any;
  onSave: (stepData: any) => void;
  onCancel: () => void;
}

interface TransformationRule {
  field_name: string;
  transformation: string;
}

export default function StepConfigForm({ step, allSteps, apiConfig, onSave, onCancel }: StepConfigFormProps) {
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
  const [nextStepOnSuccess, setNextStepOnSuccess] = useState('');
  const [nextStepOnFailure, setNextStepOnFailure] = useState('');
  const [responseDataPath, setResponseDataPath] = useState('');
  const [updateJsonPath, setUpdateJsonPath] = useState('');
  const [useApiResponseForFilename, setUseApiResponseForFilename] = useState(false);
  const [filenameSourcePath, setFilenameSourcePath] = useState('');
  const [fallbackFilename, setFallbackFilename] = useState('');
  const [sftpPathOverride, setSftpPathOverride] = useState('');
  const [renamePdfTemplate, setRenamePdfTemplate] = useState('');
  const [useExtractedDataForRename, setUseExtractedDataForRename] = useState(true);
  const [renameFallbackFilename, setRenameFallbackFilename] = useState('');
  const [appendTimestamp, setAppendTimestamp] = useState(false);
  const [timestampFormat, setTimestampFormat] = useState('YYYYMMDD');
  const [pdfUploadStrategy, setPdfUploadStrategy] = useState<'all_pages_in_group' | 'specific_page_in_group'>('all_pages_in_group');
  const [specificPageToUpload, setSpecificPageToUpload] = useState(1);
  const [uploadFileTypes, setUploadFileTypes] = useState({
    json: true,
    pdf: true,
    xml: true,
    csv: true
  });

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
        
        // API Call response handling configuration
        setResponseDataPath(config.responseDataPath || '');
        setUpdateJsonPath(config.updateJsonPath || '');
        
        // SFTP Upload configuration
        setUseApiResponseForFilename(config.useApiResponseForFilename || false);
        setFilenameSourcePath(config.filenameSourcePath || '');
        setFallbackFilename(config.fallbackFilename || '');
        setSftpPathOverride(config.sftpPathOverride || '');
        setPdfUploadStrategy(config.pdfUploadStrategy || 'all_pages_in_group');
        setSpecificPageToUpload(config.specificPageToUpload || 1);
        setUploadFileTypes(config.uploadFileTypes || { json: true, pdf: true, xml: true, csv: true });
        
        // Rename PDF configuration
        setRenamePdfTemplate(config.filenameTemplate || '');
        setUseExtractedDataForRename(config.useExtractedData !== false);
        setRenameFallbackFilename(config.fallbackFilename || '');
        setAppendTimestamp(config.appendTimestamp || false);
        setTimestampFormat(config.timestampFormat || 'YYYYMMDD');
        
        // Data Transform configuration
        setTransformations(config.transformations || [{ field_name: '', transformation: '' }]);
        
        // SFTP Upload configuration
        setSftpPath(config.sftpPath || config.sftp_path || '/uploads/xml/');
        
        // Conditional Check configuration
        setConditionalField(config.jsonPath || config.conditional_field || '');
        setConditionalOperator(config.conditionType || config.conditional_operator || 'equals');
        setConditionalValue(config.expectedValue || config.conditional_value || '');
        
        // Email Action configuration
        setEmailActionType(config.actionType || 'send_email');
        setEmailTo(config.to || '');
        setEmailSubject(config.subject || '');
        setEmailBody(config.body || '');
        setIncludeAttachment(config.includeAttachment !== false);
        setAttachmentSource(config.attachmentSource || 'original_pdf');
        setEmailFrom(config.from || '');
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
          responseDataPath: responseDataPath.trim() || undefined,
          updateJsonPath: updateJsonPath.trim() || undefined
        };
        console.log('Saving API call config:', config);
        break;
      case 'data_transform':
        config = {
          transformations: transformations.filter(t => t.field_name && t.transformation)
        };
        break;
      case 'sftp_upload':
        config = {
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
          jsonPath: conditionalField,
          conditionType: conditionalOperator,
          expectedValue: conditionalValue
        };
        break;
      case 'rename_pdf':
        config = {
          filenameTemplate: renamePdfTemplate,
          useExtractedData: useExtractedDataForRename,
          fallbackFilename: renameFallbackFilename.trim() || undefined,
          appendTimestamp: appendTimestamp,
          timestampFormat: appendTimestamp ? timestampFormat : undefined
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
          from: emailFrom
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
      nextStepOnFailureId: nextStepOnFailure || undefined
    };

    onSave(stepData);
  };

  const availableSteps = allSteps.filter(s => s.id !== step?.id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
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

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Step Type
              </label>
              <select
                value={stepType}
                onChange={(e) => setStepType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="api_call">API Call</option>
                <option value="conditional_check">Conditional Check</option>
                <option value="data_transform">Data Transform</option>
                <option value="email_action">Email Action</option>
                <option value="rename_pdf">Rename File</option>
                <option value="sftp_upload">SFTP Upload</option>
              </select>
            </div>
          </div>

          {/* Method field for API calls - shown in top row */}
          {stepType === 'api_call' && (
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="GET">GET</option>
                </select>
              </div>
            </div>
          )}

          {/* PDF Upload Strategy - Show for SFTP Upload steps */}
          {stepType === 'sftp_upload' && (
            <div className="mb-6">
              <h6 className="font-medium text-gray-700 dark:text-gray-300 mb-4">PDF Upload Strategy</h6>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Upload Strategy
                  </label>
                  <select
                    value={pdfUploadStrategy}
                    onChange={(e) => setPdfUploadStrategy(e.target.value as 'all_pages_in_group' | 'specific_page_in_group')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="all_pages_in_group">Upload All Pages in Group</option>
                    <option value="specific_page_in_group">Upload Specific Page Only</option>
                  </select>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Response Data Path
                    </label>
                    <input
                      type="text"
                      value={responseDataPath}
                      onChange={(e) => setResponseDataPath(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100"
                      placeholder="e.g., clients[0].clientId or data.result"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      JSON path to extract data from API response
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Update JSON Path
                    </label>
                    <input
                      type="text"
                      value={updateJsonPath}
                      onChange={(e) => setUpdateJsonPath(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 font-mono text-sm dark:bg-gray-700 dark:text-gray-100"
                      placeholder="e.g., orders.0.consignee.clientId"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Where to store the response data in extracted JSON
                    </p>
                  </div>
                </div>
              </div>
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Condition Type
                    </label>
                    <select
                      value={conditionalOperator}
                      onChange={(e) => setConditionalOperator(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="equals">Equals</option>
                      <option value="is_null">Is Null</option>
                      <option value="is_not_null">Is Not Null</option>
                      <option value="contains">Contains</option>
                      <option value="greater_than">Greater Than</option>
                      <option value="less_than">Less Than</option>
                    </select>
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

            {stepType === 'rename_pdf' && (
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
                    Use {`{{fieldName}}`} to reference extracted data. <strong>DO NOT include file extension</strong> - it will be added automatically based on format type (.pdf, .csv, .json, .xml).
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
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Timestamp Format
                    </label>
                    <select
                      value={timestampFormat}
                      onChange={(e) => setTimestampFormat(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                    >
                      <option value="YYYYMMDD">YYYYMMDD (e.g., 20250116)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (e.g., 2025-01-16)</option>
                      <option value="YYYYMMDD_HHMMSS">YYYYMMDD_HHMMSS (e.g., 20250116_143022)</option>
                      <option value="YYYY-MM-DD_HH-MM-SS">YYYY-MM-DD_HH-MM-SS (e.g., 2025-01-16_14-30-22)</option>
                    </select>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Action Type
                  </label>
                  <select
                    value={emailActionType}
                    onChange={(e) => setEmailActionType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                  >
                    <option value="send_email">Send Email</option>
                    <option value="archive_email">Archive Email</option>
                  </select>
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
                    placeholder="Dear {{customerName}},&#10;&#10;Your document {{invoiceNumber}} has been processed successfully.&#10;&#10;Please find the attached PDF for your records.&#10;&#10;Best regards,&#10;ParseIt System"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Attachment Source
                      </label>
                      <select
                        value={attachmentSource}
                        onChange={(e) => setAttachmentSource(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
                      >
                        <option value="original_pdf">Original PDF</option>
                        <option value="renamed_pdf">Renamed PDF (from previous step)</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Choose whether to attach the original PDF or a renamed version from a previous workflow step
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Next Step on Success
              </label>
              <select
                value={nextStepOnSuccess}
                onChange={(e) => setNextStepOnSuccess(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">End workflow</option>
                {availableSteps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stepName || s.step_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Step to execute if this step succeeds
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Next Step on Failure
              </label>
              <select
                value={nextStepOnFailure}
                onChange={(e) => setNextStepOnFailure(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">End workflow</option>
                {availableSteps.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.stepName || s.step_name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Step to execute if this step fails
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-700">
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
    </div>
  );
}