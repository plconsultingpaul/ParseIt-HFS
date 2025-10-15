import React, { useState, useEffect } from 'react';
import { Send, Loader2, CheckCircle, XCircle, Brain, FileText } from 'lucide-react';
import PageTransformerCard from './PageTransformerCard';
import type { TransformationType, SftpConfig, SettingsConfig, ApiConfig, User, WorkflowStep } from '../../types';
import { detectExtractionType } from '../../lib/geminiDetector';
import type { DetectionResult } from '../../types';
import { supabase } from '../../lib/supabase';

import { PDFDocument } from 'pdf-lib';

interface MultiPageTransformerProps {
  pdfPages: File[];
  fallbackTransformationType: TransformationType;
  allTransformationTypes: TransformationType[];
  uploadMode: 'manual' | 'auto';
  geminiApiKey: string;
  additionalInstructions: string;
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  user: User | null;
  workflowSteps: WorkflowStep[];
}

interface PageTransformationInfo {
  pageIndex: number;
  transformationType: TransformationType;
  detectionResult?: DetectionResult;
  success: boolean;
  newFilename?: string;
  error?: string;
  completed: boolean;
}
export default function MultiPageTransformer({
  pdfPages,
  fallbackTransformationType,
  allTransformationTypes,
  uploadMode,
  geminiApiKey,
  additionalInstructions,
  sftpConfig,
  settingsConfig,
  apiConfig,
  user,
  workflowSteps
}: MultiPageTransformerProps) {
  const [isTransformingAll, setIsTransformingAll] = useState(false);
  const [currentProcessingPage, setCurrentProcessingPage] = useState<number | null>(null);
  const [pageProcessingResults, setPageProcessingResults] = useState<any[]>([]);
  const [transformAllResults, setTransformAllResults] = useState<PageTransformationInfo[]>([]);
  const [pageTransformationTypes, setPageTransformationTypes] = useState<Record<number, TransformationType>>({});
  const [isDetectingTypes, setIsDetectingTypes] = useState(false);

  // Initialize page processing results when pdfPages or currentTransformationType changes
  useEffect(() => {
    setPageProcessingResults(new Array(pdfPages.length).fill(null));
    setTransformAllResults([]);
    setPageTransformationTypes({});
  }, [pdfPages, fallbackTransformationType]);

  // Trigger page-level detection when component loads or key props change
  useEffect(() => {
    if (pdfPages.length > 0 && uploadMode === 'auto' && geminiApiKey && allTransformationTypes.length > 0) {
      console.log('🔍 Triggering page-level transformation type detection...');
      detectPageTransformationTypes();
    } else {
      console.log('🔍 Skipping page-level detection:', {
        pdfPagesLength: pdfPages.length,
        uploadMode,
        hasApiKey: !!geminiApiKey,
        transformationTypesLength: allTransformationTypes.length
      });
      
      // For manual mode or when conditions aren't met, use fallback type for all pages
      const manualTypes: Record<number, TransformationType> = {};
      const manualResults: PageTransformationInfo[] = [];
      pdfPages.forEach((_, index) => {
        manualTypes[index] = fallbackTransformationType;
        manualResults[index] = {
          pageIndex: index,
          transformationType: fallbackTransformationType,
          success: false,
          completed: false
        };
      });
      setPageTransformationTypes(manualTypes);
      setTransformAllResults(manualResults);
    }
  }, [pdfPages, fallbackTransformationType, uploadMode, geminiApiKey, allTransformationTypes]);
  const handleProcessStart = (pageIndex: number) => {
    // No-op for now, state managed by individual cards
  };

  const handleProcessComplete = (pageIndex: number, result: any) => {
    setPageProcessingResults(prev => {
      const newResults = [...prev];
      newResults[pageIndex] = result;
      return newResults;
    });
  };

  const detectPageTransformationTypes = async () => {
    setIsDetectingTypes(true);
    const detectedTypes: Record<number, TransformationType> = {};
    const detectionResults: PageTransformationInfo[] = [];
    
    console.log('🔍 Starting page-level transformation type detection for', pdfPages.length, 'pages');
    
    for (let pageIndex = 0; pageIndex < pdfPages.length; pageIndex++) {
      const pageFile = pdfPages[pageIndex];
      console.log(`🔍 Detecting transformation type for page ${pageIndex + 1}:`, pageFile.name);
      
      let finalTransformationType = fallbackTransformationType;
      let finalDetectionResult: DetectionResult | null = null;
      
      try {
        const detectionResult = await detectExtractionType({
          pdfFile: pageFile,
          extractionTypes: allTransformationTypes, // Use transformation types for detection
          apiKey: geminiApiKey
        });
        
        console.log(`🔍 Page ${pageIndex + 1} detection result:`, detectionResult);
        finalDetectionResult = detectionResult;
        
        if (detectionResult.detectedTypeId) {
          const detectedType = allTransformationTypes.find(type => type.id === detectionResult.detectedTypeId);
          if (detectedType) {
            finalTransformationType = detectedType;
            console.log(`✅ Page ${pageIndex + 1} will use detected type:`, detectedType.name);
          } else {
            console.log(`⚠️ Page ${pageIndex + 1} detected unknown type, using fallback:`, fallbackTransformationType.name);
          }
        } else {
          console.log(`⚠️ Page ${pageIndex + 1} no type detected, using fallback:`, fallbackTransformationType.name);
        }
        
      } catch (detectionError) {
        console.error(`❌ Detection failed for page ${pageIndex + 1}:`, detectionError);
        console.log(`⚠️ Page ${pageIndex + 1} detection failed, using fallback:`, fallbackTransformationType.name);
        
        finalDetectionResult = {
          detectedTypeId: null,
          confidence: null,
          reasoning: `Detection failed: ${detectionError instanceof Error ? detectionError.message : 'Unknown error'}`
        };
      }
      
      // Store the final type and result for this page
      detectedTypes[pageIndex] = finalTransformationType;
      detectionResults[pageIndex] = {
        pageIndex,
        transformationType: finalTransformationType,
        detectionResult: finalDetectionResult,
        success: false,
        completed: false
      };
    }
    
    setPageTransformationTypes(detectedTypes);
    setTransformAllResults(detectionResults);
    setIsDetectingTypes(false);
    console.log('✅ Page-level detection completed. Types assigned:', Object.keys(detectedTypes).length);
  };
  const handleTransformAll = async () => {
    if (pdfPages.length === 0) return;
    
    console.log('🚀 === TRANSFORM ALL STARTED ===');
    console.log('🚀 Initial PDF pages count:', pdfPages.length);
    console.log('🚀 Page transformation types:', pageTransformationTypes);
    console.log('🚀 Transform all results:', transformAllResults);
    
    setIsTransformingAll(true);
    
    try {
      for (let pageIndex = 0; pageIndex < pdfPages.length; pageIndex++) {
        setCurrentProcessingPage(pageIndex);
        
        const pageFile = pdfPages[pageIndex];
        
        // Use the specifically detected transformation type for this page
        const pageTransformationType = pageTransformationTypes[pageIndex] || fallbackTransformationType;
        
        console.log(`🔄 Processing page ${pageIndex + 1} of ${pdfPages.length} with transformation type:`, pageTransformationType.name);
        console.log(`🔄 Page file name:`, pageFile.name);
        console.log(`🔄 Using detected type:`, pageTransformationType.id === (pageTransformationTypes[pageIndex]?.id) ? 'YES' : 'NO (fallback)');
        
        let actualUploadedFilename = '';
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        try {
          const pdfBase64 = await fileToBase64(pageFile);
         console.log('PDF converted to base64, length:', pdfBase64.length);
          
          const transformResponse = await fetch(`${supabaseUrl}/functions/v1/pdf-transformer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              pdfBase64,
              transformationType: pageTransformationType,
              additionalInstructions,
              apiKey: apiConfig.googleApiKey || settingsConfig.geminiApiKey
            })
          });

         console.log('Transform response status:', transformResponse.status);
         console.log('Transform response ok:', transformResponse.ok);

          if (!transformResponse.ok) {
            const errorData = await transformResponse.json();
           console.error('Transform failed with error:', errorData);
            throw new Error(errorData.details || errorData.error || 'Transformation failed');
          }

          const transformResult = await transformResponse.json();
         console.log('=== TRANSFORM RESULT ===');
         console.log('Transform result:', transformResult);
         console.log('New filename from transform:', transformResult.newFilename);
         console.log('Extracted data keys:', Object.keys(transformResult.extractedData || {}));
          
          // Update results with transformation success
          setTransformAllResults(prev => prev.map(result => {
            if (result.pageIndex === pageIndex) {
              return { 
                ...result, 
                success: true, 
                newFilename: transformResult.newFilename.replace(/MISSING/g, 'EXTRACTED'),
                // Use the actual transformation type that was used for processing
                transformationType: pageTransformationType,
                detectionResult: result.detectionResult,
                completed: true
              };
            }
            return result;
          }));
          
          if (pageTransformationType.workflowId) {
           console.log('=== WORKFLOW PATH ===');
           console.log('Using workflow ID:', pageTransformationType.workflowId);
            const fileName = `workflow-pdfs/${Date.now()}-${pageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('pdfs').upload(fileName, pageFile);

            if (uploadError) {
             console.error('Storage upload error:', uploadError);
              throw new Error(`Failed to upload PDF to storage: ${uploadError.message}`);
            }
           console.log('PDF uploaded to storage:', uploadData.path);
            
            const extractedDataFileName = `extracted-data/${Date.now()}-extracted-data.json`;
            const extractedDataToUpload = JSON.stringify(transformResult.extractedData) || '{}';
            
            const { data: extractedDataUpload, error: extractedDataError } = await supabase.storage
              .from('pdfs')
              .upload(extractedDataFileName, new Blob([extractedDataToUpload], { type: 'application/json' }));

            if (extractedDataError) {
             console.error('Extracted data upload error:', extractedDataError);
              throw new Error(`Failed to upload extracted data to storage: ${extractedDataError.message}`);
            }
           console.log('Extracted data uploaded to storage:', extractedDataUpload.path);
            
            const workflowRequestBody = {
              extractedData: JSON.stringify(transformResult.extractedData),
              extractedDataStoragePath: extractedDataUpload.path,
              workflowId: pageTransformationType.workflowId,
              userId: user?.id,
              transformationTypeId: pageTransformationType.id,
              pdfFilename: transformResult.newFilename,
              pdfPages: 1,
              pdfStoragePath: uploadData.path,
              originalPdfFilename: pageFile.name,
              pdfBase64: pdfBase64
            };
           console.log('=== WORKFLOW REQUEST ===');
           console.log('Workflow request body (extractedData):', JSON.stringify(transformResult.extractedData));
           console.log('Workflow request body:', workflowRequestBody);
            
            const workflowResponse = await fetch(`${supabaseUrl}/functions/v1/json-workflow-processor`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify(workflowRequestBody)
            });

           console.log('=== WORKFLOW RESPONSE ===');
           console.log('Workflow response status:', workflowResponse.status);
           console.log('Workflow response ok:', workflowResponse.ok);

            if (!workflowResponse.ok) {
              const responseText = await workflowResponse.text();
             console.error('Workflow failed with response:', responseText);
              let errorData;
              try {
                errorData = JSON.parse(responseText);
              } catch (parseError) {
                throw new Error(`Workflow execution failed with status ${workflowResponse.status}: ${responseText}`);
              }
              throw new Error(errorData.details || errorData.error || 'Workflow execution failed');
            }

            const workflowResult = await workflowResponse.json();
           console.log('=== WORKFLOW RESULT ===');
           console.log('Full workflow result:', workflowResult);
            console.log('ACTUAL FILENAME FROM WORKFLOW:', workflowResult.actualFilename);
            
            // Use the actual filename from the workflow response
            actualUploadedFilename = workflowResult.actualFilename || transformResult.newFilename;
            console.log('FINAL FILENAME TO DISPLAY:', actualUploadedFilename);
            
            try {
              await supabase.storage.from('pdfs').remove([uploadData.path]);
              await supabase.storage.from('pdfs').remove([extractedDataUpload.path]);
            } catch (cleanupError) {
              console.warn('Failed to clean up uploaded files from storage:', cleanupError);
            }

          } else {
           console.log('=== DIRECT SFTP PATH ===');
           console.log('No workflow, uploading directly to SFTP');
            const pdfBase64 = await fileToBase64(pageFile);
            
            // Calculate the actual SFTP filename that will be used
            const baseFilenameForSftp = transformResult.newFilename.replace('.pdf', '');
            actualUploadedFilename = pdfPages.length > 1 
              ? `${baseFilenameForSftp}_${pageIndex + 1}.pdf`
              : transformResult.newFilename;
           console.log('Direct SFTP filename calculated:', actualUploadedFilename);
            
            const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                sftpConfig,
                xmlContent: JSON.stringify(transformResult.extractedData),
                pdfBase64,
                baseFilename: baseFilenameForSftp,
                originalFilename: pageFile.name,
                userId: user?.id,
                transformationTypeId: pageTransformationType.id,
                formatType: 'JSON',
                exactFilename: transformResult.newFilename
              })
            });

           console.log('=== DIRECT SFTP RESPONSE ===');
           console.log('SFTP response status:', uploadResponse.status);
           console.log('SFTP response ok:', uploadResponse.ok);

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json();
             console.error('SFTP upload failed:', errorData);
              throw new Error(errorData.details || errorData.error || 'Upload failed');
            }
            
            const uploadResult = await uploadResponse.json();
           console.log('=== SFTP UPLOAD RESULT ===');
           console.log('Full SFTP result:', uploadResult);
           console.log('SFTP result keys:', Object.keys(uploadResult));
           console.log('SFTP results array:', uploadResult.results);
           console.log('SFTP actualFilenames:', uploadResult.actualFilenames);
            
            // DEBUG: Log the SFTP response to see what we're getting
            console.log('=== SFTP UPLOAD RESPONSE ===');
            console.log('Full response:', uploadResult);
            console.log('Results array:', uploadResult.results);
            console.log('ActualFilenames:', uploadResult.actualFilenames);
            
            // Get the actual filename from SFTP response
            if (uploadResult.results && uploadResult.results.length > 0) {
              actualUploadedFilename = uploadResult.results[0].filename;
             console.log('Using filename from results[0].filename:', actualUploadedFilename);
              console.log('Using filename from results:', actualUploadedFilename);
            } else if (uploadResult.actualFilenames && uploadResult.actualFilenames.length > 0) {
              actualUploadedFilename = uploadResult.actualFilenames[0];
             console.log('Using filename from actualFilenames[0]:', actualUploadedFilename);
              console.log('Using filename from actualFilenames:', actualUploadedFilename);
            } else {
              actualUploadedFilename = transformResult.newFilename;
             console.log('Using fallback filename from transform result:', actualUploadedFilename);
              console.log('Using fallback filename:', actualUploadedFilename);
            }
          }
          
         console.log('=== UPDATING RESULTS ===');
         console.log('Page index:', pageIndex);
         console.log('Final filename to display:', actualUploadedFilename);
         
          // Mark as completed
          setTransformAllResults(prev => prev.map(result => {
            if (result.pageIndex === pageIndex) {
              return { 
                ...result, 
                success: true,
                completed: true,
                newFilename: (actualUploadedFilename || transformResult.newFilename).replace(/MISSING/g, 'EXTRACTED'),
                // Use the actual transformation type that was used for processing
                transformationType: pageTransformationType,
                detectionResult: result.detectionResult
              };
            }
            return result;
          }));
          
          handleProcessComplete(pageIndex, { success: true, newFilename: (actualUploadedFilename || transformResult.newFilename).replace(/MISSING/g, 'EXTRACTED') });
         console.log('=== PAGE', pageIndex + 1, 'PROCESSING COMPLETE ===');
          
        } catch (error) {
         console.error('=== PAGE', pageIndex + 1, 'PROCESSING ERROR ===');
         console.error('Error:', error);
          // Update results with error
          setTransformAllResults(prev => prev.map(result => {
            if (result.pageIndex === pageIndex) {
              return { 
                ...result, 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error', 
                completed: true,
                // Use the actual transformation type that was attempted
                transformationType: pageTransformationType,
                detectionResult: result.detectionResult
              };
            }
            return result;
          }));
          
          handleProcessComplete(pageIndex, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
        
        if (pageIndex < pdfPages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } finally {
      setIsTransformingAll(false);
      setCurrentProcessingPage(null);
    }
  };

  const fileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
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
      {/* Vendor Simplified View */}
      {user?.role === 'vendor' ? (
        <div className="space-y-6">
          {/* Page Count and Transform All Button */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-orange-100 dark:bg-orange-900/50 p-3 rounded-lg">
                  <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {pdfPages.length} Page{pdfPages.length !== 1 ? 's' : ''} Ready for Processing
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Your PDF has been split into {pdfPages.length} page{pdfPages.length !== 1 ? 's' : ''} for intelligent processing
                  </p>
                </div>
              </div>
              <button
                onClick={handleTransformAll}
                disabled={!fallbackTransformationType || isTransformingAll || isDetectingTypes}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
              >
                {isDetectingTypes ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Detecting Types...</span>
                  </>
                ) : isTransformingAll ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>
                      Processing Page {currentProcessingPage !== null ? currentProcessingPage + 1 : '...'} of {pdfPages.length}
                    </span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    <span>Transform All Pages</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Transform All Results for Vendors */}
          {transformAllResults.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 text-lg">
                  {isDetectingTypes ? 'Detecting Transformation Types...' : isTransformingAll ? 'Processing Results' : 'Processing Complete'}
                </h4>
                {!isTransformingAll && !isDetectingTypes && (
                  <button
                    onClick={() => setTransformAllResults([])}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors duration-200"
                  >
                    Clear Results
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {transformAllResults.map((result) => (
                  <div key={result.pageIndex} className={`flex items-center justify-between p-4 rounded-lg ${
                    result.completed
                      ? result.success
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                      : currentProcessingPage === result.pageIndex
                        ? 'bg-blue-100 dark:bg-blue-800/30 border border-blue-300 dark:border-blue-600'
                        : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        result.completed
                          ? result.success
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                          : currentProcessingPage === result.pageIndex
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-300 text-gray-600'
                      }`}>
                        {result.completed ? (
                          result.success ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />
                        ) : (
                          result.pageIndex + 1
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium ${
                          result.completed
                            ? result.success
                              ? 'text-green-800 dark:text-green-300'
                              : 'text-red-800 dark:text-red-300'
                            : currentProcessingPage === result.pageIndex
                              ? 'text-blue-800 dark:text-blue-300'
                              : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          Page {result.pageIndex + 1}
                          {currentProcessingPage === result.pageIndex && !result.completed && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400">Processing...</span>
                          )}
                        </div>
                        {result.transformationType && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Type: {result.transformationType.name}
                            {result.detectionResult && uploadMode === 'auto' && (
                              <span className="ml-2">
                                ({result.detectionResult.detectedTypeId ? 
                                  `AI: ${result.detectionResult.confidence}` : 
                                  'Fallback'})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {result.completed && result.success && result.newFilename && (
                        <div className="text-sm">
                          <span className="text-gray-600 dark:text-gray-400">New Filename: </span>
                          <span className="font-mono text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800/30 px-2 py-1 rounded">
                            {result.newFilename}
                          </span>
                        </div>
                      )}
                      {result.completed && !result.success && result.error && (
                        <div className="text-sm text-red-600 dark:text-red-400 max-w-xs truncate" title={result.error}>
                          Error: {result.error}
                        </div>
                      )}
                      {!result.completed && currentProcessingPage !== result.pageIndex && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Waiting...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Regular Admin/User View */
        <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
          PDF Pages ({pdfPages.length} page{pdfPages.length !== 1 ? 's' : ''})
        </label>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTransformAll}
            disabled={!fallbackTransformationType || isTransformingAll || isDetectingTypes}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
          >
            {isDetectingTypes ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Detecting Types...</span>
              </>
            ) : isTransformingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Processing Page {currentProcessingPage !== null ? currentProcessingPage + 1 : '...'} of {pdfPages.length}
                </span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Transform All</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Transform All Progress Display */}
      {transformAllResults.length > 0 && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-blue-800 dark:text-blue-300">
              {isDetectingTypes ? 'Detecting Transformation Types...' : isTransformingAll ? 'Transform All Progress' : 'Transform All Results'}
            </h4>
            {!isTransformingAll && !isDetectingTypes && (
              <button
                onClick={() => setTransformAllResults([])}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors duration-200"
              >
                Clear Results
              </button>
            )}
          </div>
          <div className="space-y-2">
            {transformAllResults.map((result) => (
              <div key={result.pageIndex} className={`flex items-center justify-between p-3 rounded-lg ${
                result.completed
                  ? result.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                  : currentProcessingPage === result.pageIndex
                    ? 'bg-blue-100 dark:bg-blue-800/30 border border-blue-300 dark:border-blue-600'
                    : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    result.completed
                      ? result.success
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                      : currentProcessingPage === result.pageIndex
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                  }`}>
                    {result.completed ? (
                      result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />
                    ) : (
                      result.pageIndex + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium ${
                      result.completed
                        ? result.success
                          ? 'text-green-800 dark:text-green-300'
                          : 'text-red-800 dark:text-red-300'
                        : currentProcessingPage === result.pageIndex
                          ? 'text-blue-800 dark:text-blue-300'
                          : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      Page {result.pageIndex + 1}
                      {currentProcessingPage === result.pageIndex && !result.completed && (
                        <span className="ml-2 text-blue-600 dark:text-blue-400">Processing...</span>
                      )}
                    </div>
                    {result.transformationType && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Type: {result.transformationType.name}
                        {result.detectionResult && uploadMode === 'auto' && (
                          <span className="ml-2">
                            ({result.detectionResult.detectedTypeId ? 
                              `AI: ${result.detectionResult.confidence}` : 
                              'Fallback'})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {result.completed && result.success && result.newFilename && (
                    <div className="text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Filename: </span>
                      <span className="font-mono text-green-700 dark:text-green-300">{result.newFilename}</span>
                    </div>
                  )}
                  {result.completed && !result.success && result.error && (
                    <div className="text-sm text-red-600 dark:text-red-400 max-w-xs truncate" title={result.error}>
                      Error: {result.error}
                    </div>
                  )}
                  {!result.completed && currentProcessingPage !== result.pageIndex && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Waiting...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        {pdfPages.map((pageFile, pageIndex) => (
          <PageTransformerCard
            key={pageIndex}
            pageFile={pageFile}
            pageIndex={pageIndex}
            transformationType={pageTransformationTypes[pageIndex] || fallbackTransformationType}
            additionalInstructions={additionalInstructions}
            sftpConfig={sftpConfig}
            settingsConfig={settingsConfig}
            apiConfig={apiConfig}
            user={user}
            workflowSteps={workflowSteps}
            isTransformingAll={isTransformingAll}
            onProcessStart={handleProcessStart}
            onProcessComplete={handleProcessComplete}
            hidePreview={user?.role === 'vendor'}
          />
        ))}
      </div>
        </div>
      )}
    </div>
  );
}