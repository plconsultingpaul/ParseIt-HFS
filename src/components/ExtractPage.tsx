import React, { useState } from 'react';
import { Settings, Brain } from 'lucide-react';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, SecuritySettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import PdfUploadSection from './extract/PdfUploadSection';
import AutoDetectPdfUploadSection from './extract/AutoDetectPdfUploadSection';
import ExtractionControls from './extract/ExtractionControls';
import MultiPageProcessor from './extract/MultiPageProcessor';
import SingleFileProcessor from './extract/SingleFileProcessor';
import { useSupabaseData } from '../hooks/useSupabaseData';
import type { DetectionResult } from '../types';

interface ExtractPageProps {
  extractionTypes: ExtractionType[];
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  onNavigateToSettings: () => void;
}

export default function ExtractPage({ 
  extractionTypes, 
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

  // Initialize upload mode from user preference and update when user changes
  React.useEffect(() => {
    if (user?.preferredUploadMode) {
      setUploadMode(user.preferredUploadMode);
    }
  }, [user?.preferredUploadMode]);

  // Set initial upload mode when component mounts
  React.useEffect(() => {
    if (user?.preferredUploadMode) {
      setUploadMode(user.preferredUploadMode);
    }
  }, [user]);


  const currentExtractionType = extractionTypes.find(type => type.id === selectedExtractionType);

  const handlePdfUpload = (file: File, pages: File[]) => {
    setUploadedFile(file);
    setPdfPages(pages);
    setDetectionResult(null);
    // Reset the processor components by changing their key
    setPdfProcessorKey(prev => prev + 1);
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
      setSelectedExtractionType(detectedTypeId);
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
      {/* Main Card */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Upload & Extract</h2>
              <p className="text-gray-600">Select a PDF and tell the AI what to extract.</p>
            </div>
          </div>

          {/* Extraction Type and File Upload - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Extraction Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Extraction Type
              </label>
              <select
                value={selectedExtractionType}
                onChange={(e) => handleSelectExtractionType(e.target.value)}
                className="w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              >
                {extractionTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              
              {/* Detection Result Display */}
              {detectionResult && uploadMode === 'auto' && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <Brain className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">AI Detection Result</span>
                  </div>
                  {detectionResult.detectedTypeId ? (
                    <div>
                      <p className="text-sm text-blue-700">
                        <strong>Detected:</strong> {extractionTypes.find(t => t.id === detectionResult.detectedTypeId)?.name}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        <strong>Confidence:</strong> {detectionResult.confidence} • <strong>Reason:</strong> {detectionResult.reasoning}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-orange-700">
                      Could not determine type automatically. {detectionResult.reasoning}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* File Upload Options */}
            <div>
              <div className="space-y-4">
                {/* Upload Mode Toggle */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Upload Mode
                  </label>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setUploadMode('manual')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        uploadMode === 'manual'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Manual Selection
                    </button>
                    <button
                      onClick={() => setUploadMode('auto')}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        uploadMode === 'auto'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      AI Auto-Detect
                    </button>
                  </div>
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

          {/* Multi-page Processing or Single File Processing */}
          {uploadedFile && currentExtractionType && (
            <>
              {pdfPages.length > 0 ? (
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
                />
              ) : (
                <SingleFileProcessor
                  key={pdfProcessorKey}
                  uploadedFile={uploadedFile}
                  currentExtractionType={currentExtractionType}
                  additionalInstructions={additionalInstructions}
                  sftpConfig={sftpConfig}
                  settingsConfig={settingsConfig}
                  apiConfig={apiConfig}
                  user={user}
                  workflowSteps={workflowSteps}
                />
              )}
            </>
          )}

          {/* Instructions Section - Always show when extraction type is selected */}
          {currentExtractionType && (
            <div className="mt-8 space-y-6">
              {/* Default Extraction Instructions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Default Extraction Instructions
                </label>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <p className="text-purple-800 text-sm leading-relaxed whitespace-pre-wrap">
                    {currentExtractionType.defaultInstructions}
                  </p>
                </div>
              </div>

              {/* Additional Instructions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Additional Instructions (Optional)
                </label>
                <textarea
                  value={additionalInstructions}
                  onChange={(e) => handleUpdateAdditionalInstructions(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical"
                  rows={3}
                  placeholder="Add any specific instructions for this extraction..."
                />
                <p className="text-sm text-gray-500 mt-2">
                  These instructions will be added to the default ones above.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* API Key Notice */}
      {!apiConfig.googleApiKey && !settingsConfig.geminiApiKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-800">Google Gemini API Key Required</h4>
              <p className="text-amber-700 text-sm mt-1">
                To use the PDF extraction feature, please add your Google Gemini API key in the API settings.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}