import React, { useState, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import PageProcessorCard from './PageProcessorCard';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, User, PageProcessingState, ApiError } from '../../types';
import { extractDataFromPDF } from '../../lib/gemini';
import { uploadToSftp } from '../../lib/sftp';
import { sendToApi } from '../../lib/apiClient';

interface MultiPageProcessorProps {
  pdfPages: File[];
  currentExtractionType: ExtractionType;
  additionalInstructions: string;
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  user: User | null;
}

export default function MultiPageProcessor({
  pdfPages,
  currentExtractionType,
  additionalInstructions,
  sftpConfig,
  settingsConfig,
  apiConfig,
  user
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

  const processPageAction = async (pageIndex: number, actionType: 'preview' | 'process') => {
    const pageFile = pdfPages[pageIndex];
    if (!pageFile || !currentExtractionType) return;

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
        if (isJsonType) {
          // For JSON types, get ParseIt ID and send to API
          let parseitId: number | undefined;
          try {
            // Get a fresh ParseIt ID for each submission
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            
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
              parseitIdMapping: currentExtractionType.parseitIdMapping,
              useExistingParseitId: parseitId,
              userId: user?.id,
              extractionTypeId: currentExtractionType.id
            });
          } catch (sftpError) {
            console.warn('PDF upload to SFTP failed for JSON type:', sftpError);
            // Don't throw error here - API call was successful, SFTP is secondary
          }
        } else {
          // Upload XML files to SFTP
          await uploadToSftp({
            sftpConfig,
            xmlContent: extractedData,
            pdfFile: pageFile,
            baseFilename: currentExtractionType.filename || 'document',
            parseitIdMapping: currentExtractionType.parseitIdMapping,
            userId: user?.id,
            extractionTypeId: currentExtractionType.id,
            formatType: currentExtractionType.formatType
          });
        }
        
        updatePageState(pageIndex, {
          success: true,
          isProcessing: false
        });
      }
    } catch (error) {
      if (actionType === 'process' && !isJsonType) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        updatePageState(pageIndex, {
          extractionError: `Failed to upload to SFTP: ${errorMessage}`,
          isProcessing: false
        });
      } else if (actionType === 'preview') {
        const errorMessage = error instanceof Error ? error.message : 'Failed to extract data';
        updatePageState(pageIndex, {
          extractionError: errorMessage,
          isExtracting: false
        });
      } else {
        // For JSON processing errors, the error handling is done above in the API section
        updatePageState(pageIndex, {
          isProcessing: false
        });
      }
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
        
        // Small delay between pages to prevent overwhelming the API
        if (pageIndex < pdfPages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } finally {
      setIsExtractingAll(false);
      setCurrentProcessingPage(null);
    }
  };

  if (pdfPages.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-700">
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
            onPreview={handlePreviewPage}
            onProcess={handleProcessPage}
          />
        ))}
      </div>
    </div>
  );
}