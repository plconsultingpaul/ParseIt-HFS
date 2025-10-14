import React, { useState } from 'react';
import { Settings, Brain, FileText, CheckCircle } from 'lucide-react';
import type { ExtractionType, TransformationType, SftpConfig, SettingsConfig, ApiConfig } from '../types';
import { useAuth } from '../hooks/useAuth';
import PdfUploadSection from './extract/PdfUploadSection';
import AutoDetectPdfUploadSection from './extract/AutoDetectPdfUploadSection';
import MultiPageProcessor from './extract/MultiPageProcessor';
import MultiPageTransformer from './transform/MultiPageTransformer';
import { useSupabaseData } from '../hooks/useSupabaseData';
import type { DetectionResult } from '../types';

interface ExtractPageProps {
  extractionTypes: ExtractionType[];
  transformationTypes: TransformationType[];
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  onNavigateToSettings: () => void;
}

export default function ExtractPage({ 
  extractionTypes, 
  transformationTypes,
  sftpConfig, 
  settingsConfig, 
  apiConfig, 
  onNavigateToSettings 
}: ExtractPageProps) {
  const { user } = useAuth();
  const { workflowSteps } = useSupabaseData();
  const [selectedExtractionType, setSelectedExtractionType] = useState<string>(
    extractionTypes[0]?.id || ''
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<File[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [pdfProcessorKey, setPdfProcessorKey] = useState(0);
  const [uploadMode, setUploadMode] = useState<'manual' | 'auto'>('manual');
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [processingMode, setProcessingMode] = useState<'extraction' | 'transformation'>('extraction');
  const [selectedTransformationType, setSelectedTransformationType] = useState<string>(
    transformationTypes[0]?.id || ''
  );

  // Initialize upload mode from user preference and update when user changes
  React.useEffect(() => {
    if (user?.role === 'vendor') {
      // Force vendors to use AI auto-detect mode
      setUploadMode('auto');
      // Force vendors to transformation mode only
      setProcessingMode('transformation');
    } else if (user?.preferredUploadMode) {
      setUploadMode(user.preferredUploadMode);
    }
  }, [user?.preferredUploadMode]);

  // Set initial upload mode when component mounts
  React.useEffect(() => {
    if (user?.role === 'vendor') {
      // Force vendors to use AI auto-detect mode
      setUploadMode('auto');
      // Force vendors to transformation mode only
      setProcessingMode('transformation');
    } else if (user?.preferredUploadMode) {
      setUploadMode(user.preferredUploadMode);
    }
  }, [user]);

  const currentExtractionType = extractionTypes.find(type => type.id === selectedExtractionType);
  const currentTransformationType = transformationTypes.find(type => type.id === selectedTransformationType);

  const handlePdfUpload = (file: File, pages: File[]) => {
    setUploadedFile(file);
    setPdfPages(pages);
    setDetectionResult(null);
    // Reset the processor components by changing their key
    setPdfProcessorKey(prev => prev + 1);
  };

  const handleRemovePage = (pageIndex: number) => {
    setPdfPages(prev => prev.filter((_, index) => index !== pageIndex));
  };

  const handleAutoDetectionComplete = (
    file: File, 
    pages: File[], 
    detectedTypeId: string | null, 
    result: DetectionResult
  ) => {
    setUploadedFile(file);
    setPdfPages(pages);
    setDetectionResult(result);
    
    // If a type was detected, automatically select it
    if (detectedTypeId) {
      if (processingMode === 'extraction') {
        setSelectedExtractionType(detectedTypeId);
      } else {
        setSelectedTransformationType(detectedTypeId);
      }
    }
    
    // Reset the processor components by changing their key
    setPdfProcessorKey(prev => prev + 1);
  };

  const handleSelectExtractionType = (typeId: string) => {
    setSelectedExtractionType(typeId);
  };

  const handleUpdateAdditionalInstructions = (instructions: string) => {
    setAdditionalInstructions(instructions);
  };

  return (
    <div className="space-y-8">
      {/* Main Upload Card */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 dark:border-gray-700 overflow-hidden">
        <div className="p-8">
          {/* Extraction Type and File Upload - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Left Column - Extraction Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Extraction Type {uploadMode === 'auto' ? '(Fallback)' : ''}
              </label>
              <select
                value={selectedExtractionType}
                onChange={(e) => handleSelectExtractionType(e.target.value)}
                className="w-full px-4 py-3 bg-purple-50 dark:bg-gray-700 border border-purple-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              >
                {extractionTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {uploadMode === 'auto' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This type will be used for pages where AI cannot detect a specific extraction type
                </p>
              )}
              
              {/* Detection Result Display */}
              {detectionResult && uploadMode === 'auto' && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300">AI Detection Result</span>
                  </div>
                  {detectionResult.detectedTypeId ? (
                    <div>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        <strong>Detected:</strong> {extractionTypes.find(t => t.id === detectionResult.detectedTypeId)?.name}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        <strong>Confidence:</strong> {detectionResult.confidence} • <strong>Reason:</strong> {detectionResult.reasoning}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-orange-700 dark:text-orange-400">
                      Could not determine type automatically. {detectionResult.reasoning}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Right Column - Upload Options */}
            <div>
              <div className="space-y-4">
                {/* Upload Mode Toggle */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Upload Mode
                  </label>
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setUploadMode('manual')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        uploadMode === 'manual'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      Manual Selection
                    </button>
                    <button
                      onClick={() => setUploadMode('auto')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        uploadMode === 'auto'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      AI Auto-Detect
                    </button>
                  </div>
                  {uploadMode === 'auto' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Each page will be analyzed individually to determine the best extraction type
                    </p>
                  )}
                </div>

                {/* Upload Section */}
                {uploadMode === 'manual' ? (
                  <PdfUploadSection onPdfUpload={handlePdfUpload} />
                ) : (
                  <AutoDetectPdfUploadSection
                    extractionTypes={extractionTypes}
                    apiKey={apiConfig.googleApiKey || settingsConfig.geminiApiKey}
                    onDetectionComplete={handleAutoDetectionComplete}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* No Extraction Types Message */}
      {extractionTypes.length === 0 && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 dark:border-gray-700 p-8 text-center">
          <div className="bg-orange-100 dark:bg-orange-900/50 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Settings className="h-10 w-10 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">No Extraction Types</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            You need to create extraction types before you can extract data from PDFs. 
            Extraction types define how to extract data and what format to use.
          </p>
          <button
            onClick={onNavigateToSettings}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
          >
            <Settings className="h-5 w-5" />
            <span>Go to Type Setup</span>
          </button>
        </div>
      )}

      {/* Multi-page Processor */}
      {uploadedFile && currentExtractionType && pdfPages.length > 0 && (
        <MultiPageProcessor
          key={pdfProcessorKey}
          pdfPages={pdfPages}
          currentExtractionType={currentExtractionType}
          additionalInstructions={additionalInstructions}
          sftpConfig={sftpConfig}
          settingsConfig={settingsConfig}
          apiConfig={apiConfig}
          user={user}
          workflowSteps={workflowSteps}
          onRemovePage={handleRemovePage}
        />
      )}

      {/* Instructions Section - Only show when extraction type is selected and no file uploaded */}
      {currentExtractionType && !uploadedFile && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            <div className="space-y-6">
              {/* Default Extraction Instructions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Default Extraction Instructions {uploadMode === 'auto' ? '(Fallback)' : ''}
                </label>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
                  <p className="text-purple-800 dark:text-purple-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {currentExtractionType.defaultInstructions}
                  </p>
                </div>
                {uploadMode === 'auto' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    These instructions will be used for pages where AI cannot detect a specific extraction type
                  </p>
                )}
              </div>

              {/* Additional Instructions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Additional Instructions (Optional)
                </label>
                <textarea
                  value={additionalInstructions}
                  onChange={(e) => handleUpdateAdditionalInstructions(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                  rows={3}
                  placeholder="Add any specific instructions for this extraction..."
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  These instructions will be added to the default ones above.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}