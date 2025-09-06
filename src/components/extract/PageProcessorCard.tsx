import React, { useState } from 'react';
import { FileText, Send, Loader2, Copy, CheckCircle, XCircle, Eye, Database, AlertCircle } from 'lucide-react';
import type { PageProcessingState, ApiError } from '../../types';
import Modal from '../common/Modal';

interface PageProcessorCardProps {
  pageFile: File;
  pageIndex: number;
  pageState: PageProcessingState;
  isExtractingAll: boolean;
  isJsonType: boolean;
  onPreview: (pageIndex: number) => void;
  onProcess: (pageIndex: number) => void;
}

export default function PageProcessorCard({
  pageFile,
  pageIndex,
  pageState,
  isExtractingAll,
  isJsonType,
  onPreview,
  onProcess
}: PageProcessorCardProps) {
  const dataLabel = isJsonType ? 'JSON' : 'XML';

  // Extract billNumber from API response for quick display
  const getBillNumber = (): string | null => {
    if (!pageState.apiResponse) return null;
    
    try {
      const apiData = JSON.parse(pageState.apiResponse);
      // Look for billNumber in the first order (assuming orders array structure)
      if (apiData.orders && Array.isArray(apiData.orders) && apiData.orders.length > 0) {
        return apiData.orders[0].billNumber || null;
      }
      // Fallback: look for billNumber at root level
      return apiData.billNumber || null;
    } catch (error) {
      return null;
    }
  };

  const billNumber = getBillNumber();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);

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
    setModalContent(
      <div className="space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <FileText className="h-6 w-6 text-purple-600" />
          <h4 className="text-lg font-semibold text-purple-800">Extracted {dataLabel} Data</h4>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto leading-relaxed">
            {pageState.extractedData}
          </pre>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => navigator.clipboard.writeText(pageState.extractedData)}
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