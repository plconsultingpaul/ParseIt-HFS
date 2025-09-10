import React, { useState } from 'react';
import { FileText, Send, Loader2, Copy, CheckCircle, XCircle, Eye, Database, AlertCircle } from 'lucide-react';
import type { PageProcessingState, ApiError, WorkflowStep, ExtractionType, WorkflowExecutionLog } from '../../types';
import Modal from '../common/Modal';

interface PageProcessorCardProps {
  pageFile: File;
  pageIndex: number;
  pageState: PageProcessingState;
  isExtractingAll: boolean;
  isJsonType: boolean;
  workflowSteps: WorkflowStep[];
  currentExtractionType: ExtractionType;
  onPreview: (pageIndex: number) => void;
  onProcess: (pageIndex: number) => void;
}

export default function PageProcessorCard({
  pageFile,
  pageIndex,
  pageState,
  isExtractingAll,
  isJsonType,
  workflowSteps,
  currentExtractionType,
  onPreview,
  onProcess
}: PageProcessorCardProps) {
  const dataLabel = isJsonType ? 'JSON' : 'XML';

  // Extract billNumber from API response for quick display
  const getBillNumber = (): string | null => {
    console.log('getBillNumber called for page', pageIndex + 1);
    console.log('pageState:', pageState);
    
    // First, try to get bill number from the actual API response (this contains the bill number returned by the server)
    if (pageState.apiResponse) {
      console.log('Checking API response for bill number...');
      try {
        const apiData = JSON.parse(pageState.apiResponse);
        console.log('Parsed API response:', apiData);
        
        // Look for billNumber in various possible locations in API response
        if (apiData.billNumber) {
          console.log('Found billNumber in API root:', apiData.billNumber);
          return apiData.billNumber;
        }
        
        if (apiData.orders && Array.isArray(apiData.orders) && apiData.orders.length > 0) {
          const billNumber = apiData.orders[0].billNumber;
          console.log('Found billNumber in API orders[0]:', billNumber);
          if (billNumber) return billNumber;
        }
        
        // Check if API response has a data field with orders
        if (apiData.data && apiData.data.orders && Array.isArray(apiData.data.orders) && apiData.data.orders.length > 0) {
          const billNumber = apiData.data.orders[0].billNumber;
          console.log('Found billNumber in API data.orders[0]:', billNumber);
          if (billNumber) return billNumber;
        }
        
        // Check for other common API response patterns
        if (apiData.result && apiData.result.billNumber) {
          console.log('Found billNumber in API result:', apiData.result.billNumber);
          return apiData.result.billNumber;
        }
        
        // Check if the response is just a bill number string
        if (typeof apiData === 'string' && apiData.match(/^[A-Z0-9]+$/)) {
          console.log('API response appears to be a bill number string:', apiData);
          return apiData;
        }
        
      } catch (error) {
        console.error('Error parsing API response for bill number:', error);
      }
    }
    
    // For workflow executions, check if we have workflow execution log with context data
    if (pageState.workflowExecutionLog?.contextData) {
      console.log('Checking workflow execution log context data...');
      console.log('contextData:', pageState.workflowExecutionLog.contextData);
      
      try {
        const workflowData = pageState.workflowExecutionLog.contextData;
        
        // First try to get from extractedData in context
        if (workflowData.extractedData) {
          console.log('Found extractedData in workflow context:', workflowData.extractedData);
          if (workflowData.extractedData.orders && Array.isArray(workflowData.extractedData.orders) && workflowData.extractedData.orders.length > 0) {
            const billNumber = workflowData.extractedData.orders[0].billNumber;
            console.log('Found billNumber in extractedData.orders[0]:', billNumber);
            if (billNumber) return billNumber;
          }
          if (workflowData.extractedData.billNumber) {
            console.log('Found billNumber in extractedData root:', workflowData.extractedData.billNumber);
            return workflowData.extractedData.billNumber;
          }
        }
        
        // Then try to get from the root context data (final result)
        // Look for billNumber in the workflow context data
        if (workflowData.orders && Array.isArray(workflowData.orders) && workflowData.orders.length > 0) {
          const billNumber = workflowData.orders[0].billNumber;
          console.log('Found billNumber in context orders[0]:', billNumber);
          if (billNumber) return billNumber;
        }
        
        // Fallback: look for billNumber at root level of context
        if (workflowData.billNumber) {
          console.log('Found billNumber at context root:', workflowData.billNumber);
          return workflowData.billNumber;
        }
        
        console.log('No billNumber found in workflow context data');
      } catch (error) {
        console.error('Error extracting bill number from workflow context:', error);
      }
    }
    
    // Try to get bill number from extracted data directly
    if (pageState.extractedData) {
      console.log('Checking extracted data for bill number...');
      // Only try to parse as JSON if this is a JSON type extraction
      if (isJsonType) {
        try {
          const extractedJson = JSON.parse(pageState.extractedData);
          console.log('Parsed extracted data:', extractedJson);
          
          if (extractedJson.orders && Array.isArray(extractedJson.orders) && extractedJson.orders.length > 0) {
            const billNumber = extractedJson.orders[0].billNumber;
            console.log('Found billNumber in extracted orders[0]:', billNumber);
            if (billNumber) return billNumber;
          }
          
          if (extractedJson.billNumber) {
            console.log('Found billNumber in extracted root:', extractedJson.billNumber);
            return extractedJson.billNumber;
          }
        } catch (error) {
          console.error('Error parsing extracted data for bill number:', error);
        }
      } else {
        console.log('Skipping JSON parsing for XML extraction type');
      }
    }
    
    console.log('No bill number found anywhere');
    return null;
  };

  const billNumber = getBillNumber();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  const [executedStepIds, setExecutedStepIds] = useState<Set<string>>(new Set());

  // Fetch executed step IDs when workflow execution log is available
  React.useEffect(() => {
    const fetchExecutedSteps = async () => {
      if (!pageState.workflowExecutionLog?.extractionLogId) return;
      
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const response = await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?extraction_log_id=eq.${pageState.workflowExecutionLog.extractionLogId}`, {
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey
          }
        });
        
        if (response.ok) {
          const logs = await response.json();
          const stepIds = new Set(
            logs
              .filter((log: any) => log.status === 'completed' && log.current_step_id)
              .map((log: any) => log.current_step_id)
          );
          setExecutedStepIds(stepIds);
        }
      } catch (error) {
        console.error('Error fetching executed steps:', error);
      }
    };
    
    fetchExecutedSteps();
  }, [pageState.workflowExecutionLog?.extractionLogId]);

  const handlePreviewData = () => onPreview(pageIndex);
  const handleExtractAndSend = () => onProcess(pageIndex);

  const handleShowStatus = () => {
    if (pageState.success) {
      setModalTitle(`Page ${pageIndex + 1} - Success`);
      setModalContent(
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <h4 className="text-lg font-semibold text-green-800">Processing Successful!</h4>
              <p className="text-green-700">
                Data extracted and {isJsonType ? 'sent to API' : 'uploaded via SFTP'} successfully!
              </p>
            </div>
          </div>
        </div>
      );
    } else if (pageState.extractionError || pageState.apiError) {
      setModalTitle(`Page ${pageIndex + 1} - Error`);
      setModalContent(
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <h4 className="text-lg font-semibold text-red-800">Processing Failed</h4>
              <p className="text-red-700">An error occurred during processing</p>
            </div>
          </div>
          
          {pageState.extractionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h5 className="font-medium text-red-800 mb-2">Extraction Error:</h5>
              <p className="text-red-700 text-sm">{pageState.extractionError}</p>
            </div>
          )}
          
          {pageState.apiError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h5 className="font-medium text-red-800 mb-3">API Error Details:</h5>
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-red-800">Status:</span>
                    <p className="text-red-700">
                      {pageState.apiError.statusCode > 0 
                        ? `${pageState.apiError.statusCode} ${pageState.apiError.statusText}`
                        : pageState.apiError.statusText
                      }
                    </p>
                  </div>
                  {pageState.apiError.url && (
                    <div>
                      <span className="font-medium text-red-800">URL:</span>
                      <p className="text-red-700 break-all">{pageState.apiError.url}</p>
                    </div>
                  )}
                </div>
                
                {pageState.apiError.details && (
                  <div>
                    <span className="font-medium text-red-800 block mb-2">Response Details:</span>
                    <div className="bg-white rounded-lg p-3 border border-red-300 max-h-48 overflow-y-auto">
                      <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">
                        {typeof pageState.apiError.details === 'string' 
                          ? pageState.apiError.details 
                          : JSON.stringify(pageState.apiError.details, null, 2)
                        }
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }
    setShowModal(true);
  };

  const handleShowApiResponse = () => {
    setModalTitle(`Page ${pageIndex + 1} - API Response`);
    setModalContent(
      <div className="space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <Database className="h-6 w-6 text-blue-600" />
          <h4 className="text-lg font-semibold text-blue-800">API Response Data</h4>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
            {pageState.apiResponse}
          </pre>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => navigator.clipboard.writeText(pageState.apiResponse)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Copy className="h-4 w-4" />
            <span>Copy Response</span>
          </button>
        </div>
      </div>
    );
    setShowModal(true);
  };

  const handleShowExtractedData = () => {
    setModalTitle(`Page ${pageIndex + 1} - Extracted ${dataLabel} Data`);
    
    // Format JSON data for better display
    let displayData = pageState.extractedData;
    if (isJsonType) {
      try {
        const parsedJson = JSON.parse(pageState.extractedData);
        displayData = JSON.stringify(parsedJson, null, 2);
      } catch (error) {
        // If parsing fails, use original data
        displayData = pageState.extractedData;
      }
    }
    
    setModalContent(
      <div className="space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <FileText className="h-6 w-6 text-purple-600" />
          <h4 className="text-lg font-semibold text-purple-800">Extracted {dataLabel} Data</h4>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto leading-relaxed">
            {displayData}
          </pre>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => navigator.clipboard.writeText(displayData)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Copy className="h-4 w-4" />
            <span>Copy {dataLabel}</span>
          </button>
        </div>
      </div>
    );
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setModalTitle('');
    setModalContent(null);
  };

  // Get workflow steps for the current extraction type
  const currentWorkflowSteps = workflowSteps
    .filter(step => step.workflowId === currentExtractionType.workflowId)
    .sort((a, b) => a.stepOrder - b.stepOrder);

  const getStepStatus = (step: WorkflowStep) => {
    // Check if this step was actually executed by looking at the executed step IDs
    if (executedStepIds.has(step.id)) {
      return 'completed';
    }
    
    // Check if this step is currently running
    if (pageState.workflowExecutionLog?.currentStepId === step.id && pageState.workflowExecutionLog?.status === 'running') {
      return 'running';
    }
    
    // Check if this step failed
    if (pageState.workflowExecutionLog?.currentStepId === step.id && pageState.workflowExecutionLog?.status === 'failed') {
      return 'failed';
    }
    
    return 'pending';
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white';
      case 'running':
        return 'bg-blue-500 text-white animate-pulse';
      case 'failed':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-300 text-gray-600';
    }
  };

  const getStepStatusIcon = (status: string, stepOrder: number) => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'running':
        return '⟳';
      case 'failed':
        return '✗';
      default:
        return stepOrder.toString();
    }
  };

  // Determine status for the status button
  const hasStatus = pageState.success || pageState.extractionError || pageState.apiError;
  const isSuccess = pageState.success && !pageState.extractionError && !pageState.apiError;

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">PAGE {pageIndex + 1}</h4>
              <p className="text-sm text-gray-600">
                {(pageFile.size / 1024).toFixed(1)} KB
              </p>
              {billNumber && (
                <p className="text-sm font-medium text-blue-600 mt-1">
                  Bill #: {billNumber}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePreviewData}
              disabled={pageState.isExtracting || isExtractingAll}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
            >
              {pageState.isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>Preview {dataLabel}</span>
                </>
              )}
            </button>
            
            <button
              onClick={handleExtractAndSend}
              disabled={pageState.isProcessing || isExtractingAll}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 text-white font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
            >
              {pageState.isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Extract & {isJsonType ? 'Send to API' : 'Upload via SFTP'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Result Action Buttons */}
        {(hasStatus || pageState.extractedData || (isJsonType && pageState.apiResponse)) && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700">Results:</span>
              
              {/* Status Button */}
              {hasStatus && (
                <button
                  onClick={handleShowStatus}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                    isSuccess
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-red-100 text-red-800 hover:bg-red-200'
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span>Status</span>
                </button>
              )}
              
              {/* Extracted Data Button */}
              {pageState.extractedData && (
                <button
                  onClick={handleShowExtractedData}
                  className="px-3 py-2 bg-purple-100 text-purple-800 hover:bg-purple-200 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2"
                >
                  <Eye className="h-4 w-4" />
                  <span>Extracted {dataLabel}</span>
                </button>
              )}
              
              {/* API Response Button */}
              {isJsonType && (pageState.apiResponse || pageState.apiError) && (
                <button
                  onClick={handleShowApiResponse}
                  className={`px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200 flex items-center space-x-2 ${
                    pageState.apiResponse && !pageState.apiError
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                      : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                  }`}
                >
                  <Database className="h-4 w-4" />
                  <span>API Response</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Workflow Steps Display */}
        {currentExtractionType.workflowId && currentWorkflowSteps.length > 0 && (
          <div className="border-t border-gray-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Workflow Progress:</span>
              <span className="text-xs text-gray-500">
                {currentWorkflowSteps.length} step{currentWorkflowSteps.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center space-x-2 flex-wrap">
              {currentWorkflowSteps.map((step, index) => {
                const status = getStepStatus(step);
                const isLastStep = index === currentWorkflowSteps.length - 1;
                
                return (
                  <div key={step.id} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${getStepStatusColor(status)}`}
                      title={`Step ${step.stepOrder}: ${step.stepName} (${status})`}
                    >
                      {getStepStatusIcon(status, step.stepOrder)}
                    </div>
                    {!isLastStep && (
                      <div className={`w-6 h-0.5 mx-1 transition-colors duration-200 ${
                        status === 'completed' ? 'bg-green-300' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
            
            {/* Workflow Status Text */}
            {pageState.workflowExecutionLog && (
              <div className="mt-2">
                <p className="text-xs text-gray-600">
                  Status: <span className="font-medium">{pageState.workflowExecutionLog.status}</span>
                  {pageState.workflowExecutionLog.currentStepName && (
                    <span> • Current: {pageState.workflowExecutionLog.currentStepName}</span>
                  )}
                </p>
                {pageState.workflowExecutionLog.errorMessage && (
                  <p className="text-xs text-red-600 mt-1">
                    Error: {pageState.workflowExecutionLog.errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={modalTitle}
      >
        {modalContent}
      </Modal>
    </>
  );
}