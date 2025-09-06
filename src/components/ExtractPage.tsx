import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig } from '../types';
import { useAuth } from '../hooks/useAuth';
import PdfUploadSection from './extract/PdfUploadSection';
import ExtractionControls from './extract/ExtractionControls';
import MultiPageProcessor from './extract/MultiPageProcessor';
import SingleFileProcessor from './extract/SingleFileProcessor';

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
  const [selectedExtractionType, setSelectedExtractionType] = useState<string>(
    extractionTypes[0]?.id || ''
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<File[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [pdfProcessorKey, setPdfProcessorKey] = useState(0);

  const currentExtractionType = extractionTypes.find(type => type.id === selectedExtractionType);

  const handlePdfUpload = (file: File, pages: File[]) => {
    setUploadedFile(file);
    setPdfPages(pages);
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
            {/* Extraction Type Selection Only */}
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
            </div>

            {/* File Upload */}
            <div>
              <PdfUploadSection onPdfUpload={handlePdfUpload} />
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