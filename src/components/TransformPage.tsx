import React, { useState } from 'react';
import { Settings, Brain, FileText, Lock } from 'lucide-react';
import type { TransformationType, SftpConfig, SettingsConfig, ApiConfig, User, WorkflowStep, WorkflowExecutionLog, PageGroupConfig } from '../types';
import { useAuth } from '../hooks/useAuth';
import PdfUploadSection from './extract/PdfUploadSection';
import AutoDetectPdfUploadSection from './extract/AutoDetectPdfUploadSection';
import MultiPageTransformer from './transform/MultiPageTransformer';
import type { DetectionResult } from '../types';
import Select from './common/Select';
import { geminiConfigService } from '../services/geminiConfigService';

interface TransformPageProps {
  transformationTypes: TransformationType[];
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  onNavigateToSettings: () => void;
  getUserTransformationTypes: (userId: string) => Promise<string[]>;
}

export default function TransformPage({
  transformationTypes = [],
  sftpConfig,
  settingsConfig,
  apiConfig,
  onNavigateToSettings,
  getUserTransformationTypes
}: TransformPageProps) {
  const { user } = useAuth();
  const [allowedTransformationTypes, setAllowedTransformationTypes] = useState<TransformationType[]>([]);
  const [selectedTransformationType, setSelectedTransformationType] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<File[]>([]);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [uploadMode, setUploadMode] = useState<'manual' | 'auto'>('manual');
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [workflowExecutionLog, setWorkflowExecutionLog] = useState<WorkflowExecutionLog | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [usedPageGroupConfigs, setUsedPageGroupConfigs] = useState<PageGroupConfig[] | undefined>(undefined);
  const [pageRangeInfo, setPageRangeInfo] = useState<{ totalPages: number; usedPages: number[]; unusedPages: number[] } | undefined>(undefined);
  const [originalPdfFile, setOriginalPdfFile] = useState<File | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');

  // Load Gemini API key on component mount
  React.useEffect(() => {
    const loadGeminiApiKey = async () => {
      const config = await geminiConfigService.getActiveConfiguration();
      setGeminiApiKey(config?.apiKey || '');
    };
    loadGeminiApiKey();
  }, []);

  // Filter transformation types based on user permissions
  React.useEffect(() => {
    const filterTransformationTypes = async () => {
      if (!user) {
        setAllowedTransformationTypes([]);
        return;
      }

      if (user.isAdmin || user.role === 'admin') {
        setAllowedTransformationTypes(transformationTypes);
      } else if (user.role === 'user') {
        const userTypeIds = await getUserTransformationTypes(user.id);
        const filtered = transformationTypes.filter(type => userTypeIds.includes(type.id));
        setAllowedTransformationTypes(filtered);
      } else {
        setAllowedTransformationTypes(transformationTypes);
      }
    };

    filterTransformationTypes();
  }, [transformationTypes, user, getUserTransformationTypes]);

  // Update selected type when allowed types change
  React.useEffect(() => {
    if (allowedTransformationTypes.length > 0) {
      // Update if current selection is empty or not in allowed list
      const isCurrentValid = allowedTransformationTypes.some(t => t.id === selectedTransformationType);
      if (!isCurrentValid) {
        setSelectedTransformationType(allowedTransformationTypes[0].id);
      }
    }
  }, [allowedTransformationTypes]);

  // Apply default upload mode when transformation type changes
  React.useEffect(() => {
    const currentType = allowedTransformationTypes?.find(type => type.id === selectedTransformationType);

    if (currentType?.defaultUploadMode) {
      setUploadMode(currentType.defaultUploadMode);
    }
  }, [selectedTransformationType, allowedTransformationTypes]);

  const currentTransformationType = allowedTransformationTypes?.find(type => type.id === selectedTransformationType);

  const handlePdfUpload = (file: File, pages: File[]) => {
    setUploadedFile(file);
    setPdfPages(pages);
    setDetectionResult(null);
    setWorkflowExecutionLog(null);
    setUsedPageGroupConfigs(undefined);
    setPageRangeInfo(undefined);
  };

  const handleAutoDetectionComplete = (
    file: File,
    pages: File[],
    detectedTypeId: string | null,
    result: DetectionResult,
    pageGroupConfigs?: PageGroupConfig[],
    pageRangeInfoParam?: { totalPages: number; usedPages: number[]; unusedPages: number[] },
    originalPdf?: File
  ) => {
    setUploadedFile(file);
    setPdfPages(pages);
    setDetectionResult(result);
    setWorkflowExecutionLog(null);
    setUsedPageGroupConfigs(pageGroupConfigs);
    setPageRangeInfo(pageRangeInfoParam);
    setOriginalPdfFile(originalPdf || file);

    console.log('📊 TransformPage: Auto-detection complete');
    console.log('📊 Detected type ID:', detectedTypeId);
    console.log('📊 Page group configs received:', pageGroupConfigs ? 'YES' : 'NO');
    if (pageGroupConfigs) {
      console.log('📊 Page group configs count:', pageGroupConfigs.length);
    }
    if (pageRangeInfoParam) {
      console.log('📊 Page range info:', pageRangeInfoParam);
    }

    if (detectedTypeId) {
      setSelectedTransformationType(detectedTypeId);
    }
  };

  const handleSelectTransformationType = (typeId: string) => {
    setSelectedTransformationType(typeId);
  };

  const handleUpdateAdditionalInstructions = (instructions: string) => {
    setAdditionalInstructions(instructions);
  };

  return (
    <div className="space-y-8">
      {/* Main Card */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 dark:border-gray-700 overflow-hidden">
        <div className="p-8">
          {/* Transformation Type and File Upload - Side by Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Transformation Type Selection */}
            <div>
              <Select
                label={`Transformation Type ${uploadMode === 'auto' ? '(Fallback)' : ''}`}
                value={selectedTransformationType}
                onValueChange={handleSelectTransformationType}
                options={allowedTransformationTypes.map((type) => ({
                  value: type.id,
                  label: type.name
                }))}
              />
              {uploadMode === 'auto' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This type will be used for pages where AI cannot detect a specific transformation type
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
                        <strong>Detected:</strong> {allowedTransformationTypes.find(t => t.id === detectionResult.detectedTypeId)?.name}
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

              {/* Page Group Config Indicator */}
              {usedPageGroupConfigs && usedPageGroupConfigs.length > 0 && uploadMode === 'auto' && (
                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">Page Group Configuration Active</span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                    Using {usedPageGroupConfigs.length} manually configured page group{usedPageGroupConfigs.length !== 1 ? 's' : ''} instead of the main Pages Per Group setting.
                  </p>
                  {pageRangeInfo && (
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      Processing {pageRangeInfo.usedPages.length} of {pageRangeInfo.totalPages} pages
                      {pageRangeInfo.usedPages.length > 0 && ` (Pages: ${pageRangeInfo.usedPages.join(', ')})`}
                    </p>
                  )}
                </div>
              )}

              {/* Unused Pages Warning - Only show when Manual Page Group Configuration is used */}
              {pageRangeInfo && pageRangeInfo.unusedPages.length > 0 && uploadMode === 'auto' && usedPageGroupConfigs && usedPageGroupConfigs.length > 0 && (
                <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <Brain className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-medium text-orange-800 dark:text-orange-300">Unused Pages Detected</span>
                  </div>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                    {pageRangeInfo.unusedPages.length} page{pageRangeInfo.unusedPages.length !== 1 ? 's' : ''} will not be processed: Page{pageRangeInfo.unusedPages.length !== 1 ? 's' : ''} {pageRangeInfo.unusedPages.join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* File Upload Options */}
            <div>
              <div className="space-y-4">
                {/* Upload Mode Toggle */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Upload Mode
                  </label>
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => !currentTransformationType?.lockUploadMode && setUploadMode('manual')}
                      disabled={currentTransformationType?.lockUploadMode}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        uploadMode === 'manual'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent hover:border-purple-400 dark:hover:border-purple-500'
                      } ${currentTransformationType?.lockUploadMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Manual Selection
                    </button>
                    <button
                      onClick={() => !currentTransformationType?.lockUploadMode && setUploadMode('auto')}
                      disabled={currentTransformationType?.lockUploadMode}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        uploadMode === 'auto'
                          ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent hover:border-purple-400 dark:hover:border-purple-500'
                      } ${currentTransformationType?.lockUploadMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      AI Auto-Detect
                    </button>
                  </div>
                  {currentTransformationType?.lockUploadMode && (
                    <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg flex items-center space-x-2">
                      <Lock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      <p className="text-xs text-orange-700 dark:text-orange-400">
                        Upload mode is locked for this transformation type
                      </p>
                    </div>
                  )}
                  {uploadMode === 'auto' && !currentTransformationType?.lockUploadMode && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Each page will be analyzed individually to determine the best transformation type
                    </p>
                  )}
                </div>

                {/* Upload Section */}
                {uploadMode === 'manual' ? (
                  <PdfUploadSection onPdfUpload={handlePdfUpload} />
                ) : (
                  <AutoDetectPdfUploadSection
                    extractionTypes={allowedTransformationTypes}
                    apiKey={geminiApiKey}
                    onDetectionComplete={handleAutoDetectionComplete}
                  />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* No Transformation Types Message */}
      {allowedTransformationTypes.length === 0 && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-orange-100 dark:border-gray-700 p-8 text-center">
          <div className="bg-orange-100 dark:bg-orange-900/50 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Settings className="h-10 w-10 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">No Transformation Types Available</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {user?.isAdmin || user?.role === 'admin'
              ? 'You need to create transformation types before you can transform PDFs. Transformation types define how to extract data and generate new filenames.'
              : 'You do not have access to any transformation types. Please contact your administrator to request access to specific transformation types.'}
          </p>
          {(user?.isAdmin || user?.role === 'admin') && (
            <button
              onClick={onNavigateToSettings}
              className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
            >
              <Settings className="h-5 w-5" />
              <span>Go to Type Setup</span>
            </button>
          )}
        </div>
      )}

      {/* Multi-page Transformer */}
      {uploadedFile && currentTransformationType && pdfPages.length > 0 && (
        <MultiPageTransformer
          pdfPages={pdfPages}
          fallbackTransformationType={currentTransformationType}
          allTransformationTypes={allowedTransformationTypes}
          uploadMode={uploadMode}
          geminiApiKey={geminiApiKey}
          additionalInstructions={additionalInstructions}
          sftpConfig={sftpConfig}
          settingsConfig={settingsConfig}
          apiConfig={apiConfig}
          user={user}
          workflowSteps={workflowSteps}
          pageGroupConfigs={usedPageGroupConfigs}
          pageRangeInfo={pageRangeInfo}
          originalPdfFile={originalPdfFile}
        />
      )}

      {/* Instructions Section - Moved to bottom */}
      {currentTransformationType && (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            <div className="space-y-6">
              {/* Default Transformation Instructions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Default Transformation Instructions {uploadMode === 'auto' ? '(Fallback)' : ''}
                </label>
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
                  <p className="text-purple-800 dark:text-purple-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {currentTransformationType.defaultInstructions}
                  </p>
                </div>
                {uploadMode === 'auto' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    These instructions will be used for pages where AI cannot detect a specific transformation type
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
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-vertical hover:border-purple-400 dark:hover:border-purple-500 transition-colors"
                  rows={3}
                  placeholder="Add any specific instructions for this transformation..."
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