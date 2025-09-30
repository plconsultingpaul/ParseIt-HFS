import React, { useState, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import PageProcessorCard from './PageProcessorCard';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, User, PageProcessingState, ApiError, WorkflowExecutionLog } from '../../types';
import { extractDataFromPDF } from '../../lib/gemini';
import { uploadToSftp } from '../../lib/sftp';
import { executeWorkflow } from '../../lib/workflow';
import { sendToApi } from '../../lib/apiClient';

interface MultiPageProcessorProps {
  pdfPages: File[];
  currentExtractionType: ExtractionType;
  additionalInstructions: string;
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  user: User | null;
  workflowSteps: any[];
}

export default function MultiPageProcessor({
  pdfPages,
  currentExtractionType,
  additionalInstructions,
  sftpConfig,
  settingsConfig,
  apiConfig,
  user,
  workflowSteps
}: MultiPageProcessorProps) {
  const [isExtractingAll, setIsExtractingAll] = useState(false);
  const [currentProcessingPage, setCurrentProcessingPage] = useState<number | null>(null);
  const [pageProcessingStates, setPageProcessingStates] = useState<PageProcessingState[]>([]);

  const isJsonType = currentExtractionType?.formatType === 'JSON';

  // Initialize page processing states when pdfPages or currentExtractionType changes
  useEffect(() => {
    const initialStates: PageProcessingState[] = pdfPages.map(() => ({
      isProcessing: false,
      isExtracting: false,
      extractedData: '',
      extractionError: '',
      apiResponse: '',
      apiError: null,
      success: false
    }));
    setPageProcessingStates(initialStates);
  }, [pdfPages, currentExtractionType]);

  const updatePageState = (pageIndex: number, updates: Partial<PageProcessingState>) => {
    setPageProcessingStates(prev => 
      prev.map((state, index) => 
        index === pageIndex ? { ...state, ...updates } : state
      )
    );
  };

  const fetchWorkflowExecutionLog = async (logId: string): Promise<WorkflowExecutionLog | null> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${logId}`, {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey
        }
      });
      
      if (!response.ok) {
        console.error('Failed to fetch workflow execution log:', response.status);
        return null;
      }
      
      const data = await response.json();
      if (data && data.length > 0) {
        const log = data[0];
        return {
          id: log.id,
          extractionLogId: log.extraction_log_id,
          workflowId: log.workflow_id,
          status: log.status,
          currentStepId: log.current_step_id,
          currentStepName: log.current_step_name,
          errorMessage: log.error_message,
          contextData: log.context_data,
          startedAt: log.started_at,
          updatedAt: log.updated_at,
          completedAt: log.completed_at
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching workflow execution log:', error);
      return null;
    }
  };

  const processPageAction = async (pageIndex: number, actionType: 'preview' | 'process') => {
    const pageFile = pdfPages[pageIndex];
    if (!pageFile || !currentExtractionType) return;

    // Define Supabase variables at the beginning of the function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Reset state for this page
    updatePageState(pageIndex, {
      isExtracting: actionType === 'preview',
      isProcessing: actionType === 'process',
      extractionError: '',
      apiResponse: '',
      apiError: null,
      success: false
    });

    try {
      // Extract data from PDF
      const extractedData = await extractDataFromPDF({
        pdfFile: pageFile,
        defaultInstructions: currentExtractionType.defaultInstructions,
        additionalInstructions: additionalInstructions,
        formatTemplate: currentExtractionType.formatTemplate,
        formatType: currentExtractionType.formatType,
        fieldMappings: currentExtractionType.fieldMappings,
        parseitIdMapping: currentExtractionType.parseitIdMapping,
        traceTypeMapping: currentExtractionType.traceTypeMapping,
        traceTypeValue: currentExtractionType.traceTypeValue,
        apiKey: apiConfig.googleApiKey || settingsConfig.geminiApiKey
      });

      updatePageState(pageIndex, {
        extractedData,
        isExtracting: false
      });

      // If this is a process action, continue with API/SFTP operations
      if (actionType === 'process') { 
        if (currentExtractionType.workflowId) {
          // If a workflow is assigned, execute the workflow instead of direct API call
          try {
            // Convert PDF page to base64 for workflow
            const pdfBase64 = await fileToBase64(pageFile);

            const workflowResult = await executeWorkflow({
              extractedData,
              workflowId: currentExtractionType.workflowId,
              userId: user?.id,
              extractionTypeId: currentExtractionType.id,
              pdfFilename: pageFile.name,
              pdfPages: 1,
              pdfBase64: pdfBase64,
              originalPdfFilename: pageFile.name
            });
            
            // Store the workflow execution log ID for status tracking
            updatePageState(pageIndex, {
              workflowExecutionLogId: workflowResult.workflowExecutionLogId
            });
            
            // Fetch the complete workflow execution log
            const workflowLog = await fetchWorkflowExecutionLog(workflowResult.workflowExecutionLogId);
            
            updatePageState(pageIndex, {
              apiResponse: workflowResult.lastApiResponse ? JSON.stringify(workflowResult.lastApiResponse, null, 2) : JSON.stringify(workflowResult.finalData, null, 2),
              apiError: null,
              success: true,
              isProcessing: false,
              workflowExecutionLog: workflowLog
            });
          } catch (workflowError) {
            console.error('Workflow execution failed:', workflowError);
            const errorMessage = workflowError instanceof Error ? workflowError.message : 'Unknown workflow error';
            console.error('Detailed workflow error:', errorMessage);
            
            // Check if the error contains a workflow execution log ID
            let workflowLog = null;
            if ((workflowError as any).workflowExecutionLogId) {
              try {
                workflowLog = await fetchWorkflowExecutionLog((workflowError as any).workflowExecutionLogId);
              } catch (fetchError) {
                console.error('Failed to fetch workflow execution log on error:', fetchError);
              }
            }
            
            updatePageState(pageIndex, {
              extractionError: `Workflow execution failed: ${errorMessage}`,
              isProcessing: false,
              workflowExecutionLog: workflowLog
            });
          }
        } else if (isJsonType) {
          // For JSON types, get ParseIt ID and send to API
          let parseitId: number | undefined;
          try {
            // Get a fresh ParseIt ID for each submission
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_next_parseit_id`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey
              },
              body: JSON.stringify({})
            });

            if (!response.ok) {
              throw new Error('Failed to get ParseIt ID');
            }

            parseitId = await response.json();
            
            // Replace ParseIt ID placeholder with actual ID
            let finalJsonData = extractedData;
            if (currentExtractionType.parseitIdMapping && parseitId) {
              finalJsonData = finalJsonData.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, parseitId.toString());
            }
            
            // Update the displayed extracted data with the final data (including ParseIt ID)
            updatePageState(pageIndex, {
              extractedData: finalJsonData
            });
            
            // Send JSON data to API with ParseIt ID
            const apiResponseData = await sendToApi(finalJsonData, currentExtractionType, apiConfig);
            
            updatePageState(pageIndex, {
              apiResponse: JSON.stringify(apiResponseData, null, 2),
              apiError: null
            });
            
            // Extract filename part from API response for SFTP upload
            let customFilenamePart: string | undefined;
            try {
              // Try to extract billNumber from API response
              if (apiResponseData && typeof apiResponseData === 'object') {
                if (apiResponseData.billNumber) {
                  customFilenamePart = apiResponseData.billNumber;
                } else if (apiResponseData.orders && Array.isArray(apiResponseData.orders) && apiResponseData.orders.length > 0 && apiResponseData.orders[0].billNumber) {
                  customFilenamePart = apiResponseData.orders[0].billNumber;
                } else if (apiResponseData.data && apiResponseData.data.billNumber) {
                  customFilenamePart = apiResponseData.data.billNumber;
                }
              }
            } catch (error) {
              console.warn('Could not extract filename from API response:', error);
            }
            
            // Log successful API call
            try {
              await fetch(`${supabaseUrl}/rest/v1/extraction_logs`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'Content-Type': 'application/json',
                  'apikey': supabaseAnonKey
                },
                body: JSON.stringify({
                  user_id: user?.id || null,
                  extraction_type_id: currentExtractionType.id,
                  pdf_filename: pageFile.name,
                  pdf_pages: 1,
                  extraction_status: 'success',
                  error_message: null,
                  api_response: JSON.stringify(apiResponseData),
                  api_status_code: 201,
                  api_error: null,
                  extracted_data: finalJsonData,
                  created_at: new Date().toISOString()
                })
              });
            } catch (logError) {
              console.warn('Failed to log JSON extraction:', logError);
            }
          } catch (apiError) {
            // Handle API errors
            let formattedError: ApiError;
            if (apiError instanceof Error) {
              formattedError = {
                statusCode: 0,
                statusText: 'Network Error',
                details: apiError.message,
                url: apiConfig.path + (currentExtractionType?.jsonPath || ''),
                headers: {}
              };
            } else {
              formattedError = apiError as ApiError;
            }

            updatePageState(pageIndex, {
              apiError: formattedError
            });

            // Log failed API call
            try {
              console.log('Logging failed JSON extraction for page:', pageIndex + 1, formattedError);
              await fetch(`${supabaseUrl}/rest/v1/extraction_logs`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                  'Content-Type': 'application/json',
                  'apikey': supabaseAnonKey
                },
                body: JSON.stringify({
                  user_id: user?.id || null,
                  extraction_type_id: currentExtractionType.id,
                  pdf_filename: pageFile.name,
                  pdf_pages: 1,
                  extraction_status: 'failed',
                  error_message: formattedError.statusCode > 0 
                    ? `API Error ${formattedError.statusCode}: ${formattedError.statusText}`
                    : formattedError.details,
                  api_response: formattedError.details ? JSON.stringify(formattedError.details) : null,
                  api_status_code: formattedError.statusCode > 0 ? formattedError.statusCode : null,
                  api_error: JSON.stringify(formattedError),
                  extracted_data: extractedData,
                  created_at: new Date().toISOString()
                })
              });
            } catch (logError) {
              console.error('Failed to log failed JSON extraction for page', pageIndex + 1, ':', logError);
            }
            throw apiError;
          }
          
          // Also upload PDF to SFTP for JSON types
          try {
            await uploadToSftp({
              sftpConfig,
              xmlContent: extractedData,
              pdfFile: pageFile,
              baseFilename: currentExtractionType.filename || 'document',
              parseitId,
              customFilenamePart
            });
          } catch (sftpError) {
            console.warn('SFTP upload failed for JSON type:', sftpError);
            const errorMessage = sftpError instanceof Error ? sftpError.message : 'Unknown SFTP error';
            updatePageState(pageIndex, {
              extractionError: `Failed to upload to SFTP: ${errorMessage}`,
              isProcessing: false
            });
          }
        } else {
          // For non-JSON types, handle SFTP upload
          try {
            await uploadToSftp({
              sftpConfig,
              xmlContent: extractedData,
              pdfFile: pageFile,
              baseFilename: currentExtractionType.filename || 'document'
            });
            
            updatePageState(pageIndex, {
              success: true,
              isProcessing: false
            });
          } catch (sftpError) {
            const errorMessage = sftpError instanceof Error ? sftpError.message : 'Unknown SFTP error';
            updatePageState(pageIndex, {
              extractionError: `Failed to upload to SFTP: ${errorMessage}`,
              isProcessing: false
            });
          }
        }
        
        updatePageState(pageIndex, {
          success: true,
          isProcessing: false
        });
      } else {
        updatePageState(pageIndex, {
          isExtracting: false
        });
      }
    } catch (error) {
      // For JSON processing errors, the error handling is done above in the API section
      updatePageState(pageIndex, {
        isProcessing: false
      });
      console.error(`Error ${actionType}ing page ${pageIndex + 1}:`, error);
    }
  };

  const handlePreviewPage = (pageIndex: number) => {
    processPageAction(pageIndex, 'preview');
  };

  const handleProcessPage = (pageIndex: number) => {
    processPageAction(pageIndex, 'process');
  };

  const handleExtractAll = async () => {
    if (pdfPages.length === 0) return;
    
    setIsExtractingAll(true);
    
    try {
      for (let pageIndex = 0; pageIndex < pdfPages.length; pageIndex++) {
        setCurrentProcessingPage(pageIndex);
        
        console.log(`Extract All: Processing page ${pageIndex + 1} of ${pdfPages.length}`);
        
        // Process each page
        await processPageAction(pageIndex, 'process');
        
        if (pageIndex < pdfPages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (workflowError) {
      console.error('Workflow execution failed:', workflowError);
      const errorMessage = workflowError instanceof Error ? workflowError.message : 'Unknown workflow error';
      console.error('Detailed workflow error:', errorMessage);
    } finally {
      setIsExtractingAll(false);
      setCurrentProcessingPage(null);
    }
  };

  const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64 data
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  if (pdfPages.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          PDF Pages ({pdfPages.length} page{pdfPages.length !== 1 ? 's' : ''})
        </label>
        <button
          onClick={handleExtractAll}
          disabled={!currentExtractionType || isExtractingAll}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
        >
          {isExtractingAll ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Processing Page {currentProcessingPage !== null ? currentProcessingPage + 1 : '...'} of {pdfPages.length}
              </span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>Extract All</span>
            </>
          )}
        </button>
      </div>
      <div className="space-y-4">
        {pdfPages.map((pageFile, pageIndex) => (
          <PageProcessorCard
            key={pageIndex}
            pageFile={pageFile}
            pageIndex={pageIndex}
            pageState={pageProcessingStates[pageIndex] || {
              isProcessing: false,
              isExtracting: false,
              extractedData: '',
              extractionError: '',
              apiResponse: '',
              apiError: null,
              success: false
            }}
            isExtractingAll={isExtractingAll}
            isJsonType={isJsonType}
            workflowSteps={workflowSteps}
            currentExtractionType={currentExtractionType}
            onPreview={handlePreviewPage}
            onProcess={handleProcessPage}
          />
        ))}
      </div>
    </div>
  );
}