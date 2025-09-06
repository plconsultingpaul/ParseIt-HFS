import React, { useState } from 'react';
import { FileText, Send, Download, X, Loader2, Copy } from 'lucide-react';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, User, ApiError } from '../../types';
import { extractDataFromPDF } from '../../lib/gemini';
import { uploadToSftp } from '../../lib/sftp';
import { sendToApi } from '../../lib/apiClient';

interface SingleFileProcessorProps {
  uploadedFile: File;
  currentExtractionType: ExtractionType;
  additionalInstructions: string;
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  user: User | null;
}

export default function SingleFileProcessor({
  uploadedFile,
  currentExtractionType,
  additionalInstructions,
  sftpConfig,
  settingsConfig,
  apiConfig,
  user
}: SingleFileProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [apiResponse, setApiResponse] = useState('');
  const [apiResponseError, setApiResponseError] = useState<ApiError | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const isJsonType = currentExtractionType?.formatType === 'JSON';
  const previewButtonText = isJsonType ? 'Preview JSON' : 'Preview XML';
  const dataLabel = isJsonType ? 'JSON' : 'XML';

  const handlePreviewData = async () => {
    if (!uploadedFile || !currentExtractionType) return;
    
    setIsExtracting(true);
    setExtractionError('');
    setExtractedData('');
    
    try {
      const result = await extractDataFromPDF({
        pdfFile: uploadedFile,
        defaultInstructions: currentExtractionType.defaultInstructions,
        additionalInstructions: additionalInstructions,
        formatTemplate: currentExtractionType.formatTemplate,
        formatType: currentExtractionType.formatType,
        fieldMappings: currentExtractionType.fieldMappings,
        parseitIdMapping: currentExtractionType.parseitIdMapping,
        apiKey: apiConfig.googleApiKey || settingsConfig.geminiApiKey
      });
      
      setExtractedData(result);
    } catch (error) {
      setExtractionError(error instanceof Error ? error.message : 'Failed to extract data');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExtractAndSend = async () => {
    if (!uploadedFile || !currentExtractionType) return;
    
    setIsProcessing(true);
    setSendSuccess(false);
    setExtractionError('');
    setApiResponse('');
    setApiResponseError(null);
    
    try {
      // If we don't have extracted data yet, extract it first
      let dataToSend = extractedData;
      
      if (!dataToSend) {
        dataToSend = await extractDataFromPDF({
          pdfFile: uploadedFile,
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
        setExtractedData(dataToSend);
      }
      
      if (isJsonType) {
        // For JSON types, get ParseIt ID and inject it before sending to API
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
          let finalJsonData = dataToSend;
          if (currentExtractionType.parseitIdMapping && parseitId) {
            finalJsonData = finalJsonData.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, parseitId.toString());
          }
          
          // Update the displayed extracted data with the final data (including ParseIt ID)
          setExtractedData(finalJsonData);
          
          // Send JSON data to API with ParseIt ID
          const apiResponseData = await sendToApi(finalJsonData, currentExtractionType, apiConfig);
          
          setApiResponse(JSON.stringify(apiResponseData, null, 2));
          setApiResponseError(null);
          
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
                pdf_filename: uploadedFile.name,
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
          // Log failed API call
          try {
            console.log('Logging failed JSON extraction:', apiError);
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
                pdf_filename: uploadedFile.name,
                pdf_pages: 1,
                extraction_status: 'failed',
                error_message: apiError instanceof Error ? apiError.message : `API Error ${(apiError as ApiError).statusCode}: ${(apiError as ApiError).statusText}`,
                api_response: apiError instanceof Error ? null : JSON.stringify((apiError as ApiError).details),
                api_status_code: apiError instanceof Error ? null : (apiError as ApiError).statusCode,
                api_error: apiError instanceof Error ? apiError.message : JSON.stringify(apiError),
                extracted_data: dataToSend,
                created_at: new Date().toISOString()
              })
            });
          } catch (logError) {
            console.error('Failed to log failed JSON extraction:', logError);
          }
          throw apiError;
        }
        
        // Also upload PDF to SFTP for JSON types
        try {
          await uploadToSftp({
            sftpConfig,
            xmlContent: dataToSend,
            pdfFile: uploadedFile,
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
          xmlContent: dataToSend,
          pdfFile: uploadedFile,
          baseFilename: currentExtractionType.filename || 'document',
          parseitIdMapping: currentExtractionType.parseitIdMapping,
          userId: user?.id,
          extractionTypeId: currentExtractionType.id,
          formatType: currentExtractionType.formatType
        });
      }
      
      setSendSuccess(true);
    } catch (error) {
      if (isJsonType) {
        if (error instanceof Error) {
          // Handle regular errors (like network issues)
          setApiResponseError({
            statusCode: 0,
            statusText: 'Network Error',
            details: error.message,
            url: apiConfig.path + (currentExtractionType?.jsonPath || ''),
            headers: {}
          });
        } else {
          // Handle API errors with detailed information
          setApiResponseError(error as ApiError);
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setExtractionError(`Failed to upload to SFTP: ${errorMessage}`);
      }
      console.error('Extract and send error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadData = () => {
    if (!extractedData) return;
    
    const mimeType = isJsonType ? 'application/json' : 'application/xml';
    const fileExtension = isJsonType ? 'json' : 'xml';
    
    const blob = new Blob([extractedData], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-data-${Date.now()}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    if (!extractedData) return;
    
    try {
      await navigator.clipboard.writeText(extractedData);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = extractedData;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const clearExtractedData = () => {
    setExtractedData('');
    setExtractionError('');
    setCopySuccess(false);
  };

  return (
    <div className="space-y-6">
      {/* Multi-page processing section */}
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
              currentExtractionType={currentExtractionType}
              additionalInstructions={additionalInstructions}
              sftpConfig={sftpConfig}
              settingsConfig={settingsConfig}
              apiConfig={apiConfig}
              user={user}
              isExtractingAll={isExtractingAll}
            />
          ))}
        </div>
      </div>

      {/* Single file action buttons (shown when no pages are split) */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={handlePreviewData}
          disabled={!uploadedFile || !currentExtractionType || isExtracting}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
        >
          {isExtracting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Extracting...</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              <span>{previewButtonText}</span>
            </>
          )}
        </button>
        
        <button
          onClick={handleExtractAndSend}
          disabled={!uploadedFile || !currentExtractionType || isProcessing}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-300 text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
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

      {/* Success Message */}
      {sendSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="font-semibold text-green-800">Success!</span>
          </div>
          <p className="text-green-700 text-sm mt-1">
            Data extracted and {isJsonType ? 'sent to API' : 'uploaded via SFTP'} successfully!
          </p>
        </div>
      )}

      {/* API Response for JSON types - Success only */}
      {isJsonType && apiResponse && !apiResponseError && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="font-semibold text-blue-800">API Response</span>
          </div>
          <div className="bg-white rounded-lg p-4 border max-h-64 overflow-y-auto">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
              {apiResponse}
            </pre>
          </div>
        </div>
      )}

      {/* JSON API Error Status Box */}
      {isJsonType && apiResponseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="font-semibold text-red-800">
              API Error {apiResponseError.statusCode > 0 ? `${apiResponseError.statusCode}` : ''}
            </span>
          </div>
          
          <div className="space-y-3">
            {/* Status and URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-red-800">Status:</span>
                <p className="text-red-700">
                  {apiResponseError.statusCode > 0 
                    ? `${apiResponseError.statusCode} ${apiResponseError.statusText}`
                    : apiResponseError.statusText
                  }
                </p>
              </div>
              {apiResponseError.url && (
                <div>
                  <span className="font-medium text-red-800">URL:</span>
                  <p className="text-red-700 break-all">{apiResponseError.url}</p>
                </div>
              )}
            </div>

            {/* Response Details */}
            {apiResponseError.details && (
              <div>
                <span className="font-medium text-red-800 block mb-2">Response Details:</span>
                <div className="bg-white rounded-lg p-3 border border-red-300 max-h-48 overflow-y-auto">
                  <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">
                    {typeof apiResponseError.details === 'string' 
                      ? apiResponseError.details 
                      : JSON.stringify(apiResponseError.details, null, 2)
                    }
                  </pre>
                </div>
              </div>
            )}

            {/* Response Headers */}
            {apiResponseError.headers && Object.keys(apiResponseError.headers).length > 0 && (
              <div>
                <span className="font-medium text-red-800 block mb-2">Response Headers:</span>
                <div className="bg-white rounded-lg p-3 border border-red-300 max-h-32 overflow-y-auto">
                  <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">
                    {JSON.stringify(apiResponseError.headers, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <p className="text-red-600 text-xs mt-3">
              Please check your API configuration, endpoint URL, and JSON data format.
            </p>
          </div>
        </div>
      )}

      {/* Extraction Error Display */}
      {extractionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
            <span className="font-semibold text-red-800">Extraction Error</span>
          </div>
          <p className="text-red-700 text-sm">{extractionError}</p>
          {extractionError.includes('503') && extractionError.toLowerCase().includes('overloaded') ? (
            <p className="text-red-600 text-xs mt-2">
              The AI service is temporarily overloaded. Please wait a moment and try again.
            </p>
          ) : (
            <p className="text-red-600 text-xs mt-2">
              Please check your PDF file and try again. Make sure you have configured your Gemini API key.
            </p>
          )}
        </div>
      )}

      {/* Data Preview Section */}
      {(extractedData || extractionError) && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Extracted {dataLabel} Data</h3>
                <p className="text-gray-600 mt-1">
                  {extractionError ? 'Extraction failed' : 'Generated from your PDF document'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {extractedData && (
                  <>
                    <button
                      onClick={handleCopyToClipboard}
                      className={`px-4 py-2 font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2 ${
                        copySuccess 
                          ? 'bg-green-600 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <Copy className="h-4 w-4" />
                      <span>{copySuccess ? 'Copied!' : 'Copy to Clipboard'}</span>
                    </button>
                    <button
                      onClick={handleDownloadData}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download {dataLabel}</span>
                    </button>
                  </>
                )}
                <button
                  onClick={clearExtractedData}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {extractionError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="font-semibold text-red-800">Extraction Error</span>
                </div>
                <p className="text-red-700 text-sm">{extractionError}</p>
                {extractionError.includes('503') && extractionError.toLowerCase().includes('overloaded') ? (
                  <p className="text-red-600 text-xs mt-2">
                    The AI service is temporarily overloaded. Please wait a moment and try again.
                  </p>
                ) : (
                  <p className="text-red-600 text-xs mt-2">
                    Please check your PDF file and try again. Make sure you have configured your Gemini API key.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                  {extractedData}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}