import React, { useState, useEffect } from 'react';
import { Send, Loader2, CheckCircle, XCircle, Brain, FileText, Layers, Edit3 } from 'lucide-react';
import PageTransformerCard from './PageTransformerCard';
import ManualGroupEditor from './ManualGroupEditor';
import type { TransformationType, SftpConfig, SettingsConfig, ApiConfig, User, WorkflowStep, PageGroupConfig, ManualGroupEdit } from '../../types';
import { detectExtractionType } from '../../lib/geminiDetector';
import type { DetectionResult } from '../../types';
import { supabase } from '../../lib/supabase';
import { splitPdfWithManualGroups } from '../../lib/pdfUtils';

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
  pageGroupConfigs?: PageGroupConfig[];
  pageRangeInfo?: { totalPages: number; usedPages: number[]; unusedPages: number[] };
  originalPdfFile?: File | null;
}

interface PageTransformationInfo {
  pageIndex: number;
  transformationType: TransformationType;
  detectionResult?: DetectionResult;
  success: boolean;
  newFilename?: string;
  error?: string;
  completed: boolean;
  pageStart?: number;
  pageEnd?: number;
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
  workflowSteps,
  pageGroupConfigs,
  pageRangeInfo,
  originalPdfFile
}: MultiPageTransformerProps) {
  const [isTransformingAll, setIsTransformingAll] = useState(false);
  const [currentProcessingPage, setCurrentProcessingPage] = useState<number | null>(null);
  const [pageProcessingResults, setPageProcessingResults] = useState<any[]>([]);
  const [transformAllResults, setTransformAllResults] = useState<PageTransformationInfo[]>([]);
  const [pageTransformationTypes, setPageTransformationTypes] = useState<Record<number, TransformationType>>({});
  const [isDetectingTypes, setIsDetectingTypes] = useState(false);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [manuallyEditedGroups, setManuallyEditedGroups] = useState<ManualGroupEdit[] | null>(null);
  const [manuallyEditedPdfPages, setManuallyEditedPdfPages] = useState<File[] | null>(null);

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

  const handleOpenManualEditor = () => {
    setShowManualEditor(true);
  };

  const handleCloseManualEditor = () => {
    setShowManualEditor(false);
  };

  const handleSaveManualEdits = async (editedGroups: ManualGroupEdit[]) => {
    console.log('📝 Applying manual group edits:', editedGroups);

    try {
      if (!pdfPages || pdfPages.length === 0) {
        console.error('No PDF pages available for manual editing');
        return;
      }

      // Use the original PDF file if available, otherwise reconstruct
      let pdfToSplit: File;

      if (originalPdfFile) {
        console.log('✅ Using original PDF file for manual edits');
        pdfToSplit = originalPdfFile;
      } else {
        console.log('⚠️ Original PDF not available, reconstructing from pages');
        const firstPageFile = pdfPages[0];
        const originalFileName = firstPageFile.name.split('_group_')[0] + '.pdf';

        if (pdfPages.length === 1 && !firstPageFile.name.includes('_group_')) {
          pdfToSplit = firstPageFile;
        } else {
          const pdfDoc = await PDFDocument.create();
          for (const pageFile of pdfPages) {
            const pageArrayBuffer = await pageFile.arrayBuffer();
            const pagePdfDoc = await PDFDocument.load(pageArrayBuffer);
            const copiedPages = await pdfDoc.copyPages(pagePdfDoc, pagePdfDoc.getPageIndices());
            copiedPages.forEach(page => pdfDoc.addPage(page));
          }
          const pdfBytes = await pdfDoc.save();
          pdfToSplit = new File([pdfBytes], originalFileName, { type: 'application/pdf' });
        }
      }

      // Get the total page count for validation
      const pdfDoc = await PDFDocument.load(await pdfToSplit.arrayBuffer());
      const totalPages = pdfDoc.getPageCount();

      console.log(`📊 PDF has ${totalPages} pages`);
      console.log('📝 Validating edited groups against original PDF...');

      // Validate page numbers against the PDF we're actually splitting
      for (const group of editedGroups) {
        for (const pageNum of group.pages) {
          if (pageNum < 1 || pageNum > totalPages) {
            const errorMsg = `Invalid page number ${pageNum} in group ${group.groupOrder}. PDF only has ${totalPages} pages (valid range: 1-${totalPages}).`;
            console.error('❌ Validation failed:', errorMsg);
            alert(errorMsg);
            return;
          }
        }
      }

      console.log('✅ All page numbers validated successfully');

      // Split the PDF with manual groups
      const results = await splitPdfWithManualGroups(pdfToSplit, editedGroups);
      const newPdfPages = results.map(r => r.file);

      setManuallyEditedGroups(editedGroups);
      setManuallyEditedPdfPages(newPdfPages);

      console.log('✅ Manual edits applied successfully');
      console.log('📄 New PDF pages created:', newPdfPages.length);
    } catch (error) {
      console.error('Failed to apply manual edits:', error);
      alert(`Failed to apply manual edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    const sessionId = `transform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionStartTime = Date.now();

    console.log('===============================================');
    console.log(`INFO [handleTransformAll]: SESSION START - ${sessionId}`);
    console.log(`INFO [handleTransformAll]: Timestamp: ${new Date().toISOString()}`);
    console.log('===============================================');

    const pagesToProcess = manuallyEditedPdfPages || pdfPages;

    if (pagesToProcess.length === 0) {
      console.warn(`WARNING [handleTransformAll]: No PDF pages to transform - ${sessionId}`);
      return;
    }

    console.log(`INFO [handleTransformAll]: PDF pages count: ${pagesToProcess.length} - ${sessionId}`);
    console.log(`INFO [handleTransformAll]: Using manually edited pages: ${!!manuallyEditedPdfPages} - ${sessionId}`);
    console.log(`TRACE [handleTransformAll]: Page transformation types count: ${Object.keys(pageTransformationTypes).length} - ${sessionId}`);
    console.log(`TRACE [handleTransformAll]: Transform all results count: ${transformAllResults.length} - ${sessionId}`);
    console.log(`TRACE [handleTransformAll]: Fallback transformation type: ${fallbackTransformationType?.name} (${fallbackTransformationType?.id}) - ${sessionId}`);
    console.log(`TRACE [handleTransformAll]: Upload mode: ${uploadMode} - ${sessionId}`);
    console.log(`TRACE [handleTransformAll]: User role: ${user?.role} - ${sessionId}`);

    console.log(`TRACE [handleTransformAll]: Setting isTransformingAll to true - ${sessionId}`);
    setIsTransformingAll(true);

    try {
      console.log(`INFO [handleTransformAll]: Starting page-by-page transformation loop - ${sessionId}`);

      for (let pageIndex = 0; pageIndex < pagesToProcess.length; pageIndex++) {
        const pageStartTime = Date.now();
        console.log('-----------------------------------------------');
        console.log(`INFO [handleTransformAll]: Processing page ${pageIndex + 1}/${pagesToProcess.length} - ${sessionId}`);
        console.log('-----------------------------------------------');

        console.log(`TRACE [handleTransformAll]: Setting currentProcessingPage to ${pageIndex} - ${sessionId}`);
        setCurrentProcessingPage(pageIndex);

        const pageFile = pagesToProcess[pageIndex];
        console.log(`TRACE [handleTransformAll]: Page file name: ${pageFile.name} - ${sessionId}`);
        console.log(`TRACE [handleTransformAll]: Page file size: ${pageFile.size} bytes - ${sessionId}`);
        console.log(`TRACE [handleTransformAll]: Page file type: ${pageFile.type} - ${sessionId}`);

        // Use the specifically detected transformation type for this page
        const pageTransformationType = pageTransformationTypes[pageIndex] || fallbackTransformationType;
        const isDetectedType = pageTransformationType.id === pageTransformationTypes[pageIndex]?.id;

        // Check if we have a page group config for this page
        // Extract group order from filename (e.g., "state2_group_1_pages_3-3.pdf" -> group 1)
        let currentGroupConfig = undefined;
        if (pageGroupConfigs && pageGroupConfigs.length > 0) {
          const groupMatch = pageFile.name.match(/_group_(\d+)_/);
          if (groupMatch) {
            const groupOrder = parseInt(groupMatch[1], 10);
            currentGroupConfig = pageGroupConfigs.find(cfg => cfg.groupOrder === groupOrder);
            console.log(`TRACE [handleTransformAll]: Extracted group order ${groupOrder} from filename, found config: ${!!currentGroupConfig} - ${sessionId}`);
          }
        }

        // Determine which workflow to use: prioritize page group config over transformation type
        const activeWorkflowId = currentGroupConfig?.workflowId || pageTransformationType.workflowId;
        const workflowSource = currentGroupConfig?.workflowId ? 'page_group_config' : 'transformation_type';

        console.log(`INFO [handleTransformAll]: Transformation type: ${pageTransformationType.name} (ID: ${pageTransformationType.id}) - ${sessionId}`);
        console.log(`TRACE [handleTransformAll]: Using detected type: ${isDetectedType ? 'YES' : 'NO (fallback)'} - ${sessionId}`);
        console.log(`TRACE [handleTransformAll]: Page group config present: ${!!currentGroupConfig} - ${sessionId}`);
        console.log(`TRACE [handleTransformAll]: Workflow ID: ${activeWorkflowId || 'none'} - ${sessionId}`);
        console.log(`TRACE [handleTransformAll]: Workflow source: ${workflowSource} - ${sessionId}`);

        let actualUploadedFilename = '';
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        console.log(`TRACE [handleTransformAll]: Supabase URL: ${supabaseUrl ? 'SET' : 'NOT SET'} - ${sessionId}`);
        console.log(`TRACE [handleTransformAll]: Supabase Anon Key: ${supabaseAnonKey ? 'SET' : 'NOT SET'} - ${sessionId}`);

        try {
          console.log(`TRACE [handleTransformAll]: Converting PDF to base64 - ${sessionId}`);
          const base64StartTime = Date.now();
          const pdfBase64 = await fileToBase64(pageFile);
          console.log(`TRACE [handleTransformAll]: PDF converted to base64 in ${Date.now() - base64StartTime}ms, length: ${pdfBase64.length} chars - ${sessionId}`);


          console.log(`INFO [handleTransformAll]: Calling pdf-transformer Edge Function - ${sessionId}`);
          const apiKey = apiConfig.googleApiKey || settingsConfig.geminiApiKey;
          console.log(`TRACE [handleTransformAll]: API key present: ${!!apiKey} - ${sessionId}`);

          const requestBody = {
            pdfBase64,
            transformationType: currentGroupConfig ? {
              ...pageTransformationType,
              ...(currentGroupConfig.fieldMappings && { fieldMappings: currentGroupConfig.fieldMappings }),
              ...(currentGroupConfig.filenameTemplate && { filenameTemplate: currentGroupConfig.filenameTemplate })
            } : pageTransformationType,
            additionalInstructions,
            apiKey,
            sessionId,
            groupOrder: currentGroupConfig?.groupOrder || null,
            pageIndex: pageIndex
          };

          console.log(`TRACE [handleTransformAll]: Request body keys: ${Object.keys(requestBody).join(', ')} - ${sessionId}`);
          console.log(`TRACE [handleTransformAll]: Request body size estimate: ${JSON.stringify(requestBody).length} chars - ${sessionId}`);

          const fetchStartTime = Date.now();
          const transformResponse = await fetch(`${supabaseUrl}/functions/v1/pdf-transformer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify(requestBody)
          });

          console.log(`INFO [handleTransformAll]: Transform response received in ${Date.now() - fetchStartTime}ms - ${sessionId}`);
          console.log(`TRACE [handleTransformAll]: Response status: ${transformResponse.status} - ${sessionId}`);
          console.log(`TRACE [handleTransformAll]: Response ok: ${transformResponse.ok} - ${sessionId}`);
          console.log(`TRACE [handleTransformAll]: Response status text: ${transformResponse.statusText} - ${sessionId}`);

          if (!transformResponse.ok) {
            console.error(`ERROR [handleTransformAll]: Transform request failed with status ${transformResponse.status} - ${sessionId}`);
            try {
              const errorData = await transformResponse.json();
              console.error(`ERROR [handleTransformAll]: Error response data: ${JSON.stringify(errorData)} - ${sessionId}`);
              throw new Error(errorData.details || errorData.error || 'Transformation failed');
            } catch (parseError) {
              console.error(`ERROR [handleTransformAll]: Could not parse error response - ${sessionId}`);
              throw new Error(`Transformation failed with status ${transformResponse.status}`);
            }
          }

          console.log(`TRACE [handleTransformAll]: Parsing transform response JSON - ${sessionId}`);
          const parseStartTime = Date.now();
          let transformResult;
          try {
            transformResult = await transformResponse.json();
            console.log(`TRACE [handleTransformAll]: Response JSON parsed in ${Date.now() - parseStartTime}ms - ${sessionId}`);
          } catch (parseError) {
            console.error(`ERROR [handleTransformAll]: Failed to parse transform response JSON - ${sessionId}`);
            console.error(`ERROR [handleTransformAll]: Parse error:`, parseError);
            throw new Error('Failed to parse transformation response');
          }

          console.log('===============================================');
          console.log(`INFO [handleTransformAll]: TRANSFORM RESULT - ${sessionId}`);
          console.log('===============================================');
          console.log(`TRACE [handleTransformAll]: Result keys: ${Object.keys(transformResult).join(', ')} - ${sessionId}`);
          console.log(`TRACE [handleTransformAll]: New filename: ${transformResult.newFilename} - ${sessionId}`);
          console.log(`TRACE [handleTransformAll]: Has extracted data: ${!!transformResult.extractedData} - ${sessionId}`);
          if (transformResult.extractedData) {
            console.log(`TRACE [handleTransformAll]: Extracted data keys: ${Object.keys(transformResult.extractedData).join(', ')} - ${sessionId}`);
            console.log(`TRACE [handleTransformAll]: Extracted data size: ${JSON.stringify(transformResult.extractedData).length} chars - ${sessionId}`);
          }
          
          // Update results with transformation success
          console.log(`TRACE [handleTransformAll]: Updating transformAllResults with success for page ${pageIndex} - ${sessionId}`);
          console.log(`TRACE [handleTransformAll]: Previous results array length: ${transformAllResults.length} - ${sessionId}`);

          setTransformAllResults(prev => {
            console.log(`TRACE [handleTransformAll]: State update callback - prev array length: ${prev.length} - ${sessionId}`);
            const newResults = prev.map(result => {
              if (result.pageIndex === pageIndex) {
                console.log(`TRACE [handleTransformAll]: Updating result for page ${pageIndex} - ${sessionId}`);
                return {
                  ...result,
                  success: true,
                  newFilename: transformResult.newFilename.replace(/MISSING/g, 'EXTRACTED'),
                  transformationType: pageTransformationType,
                  detectionResult: result.detectionResult,
                  completed: true
                };
              }
              return result;
            });
            console.log(`TRACE [handleTransformAll]: Returning new results array, length: ${newResults.length} - ${sessionId}`);
            return newResults;
          });
          
          if (activeWorkflowId) {
           console.log('=== WORKFLOW PATH ===');
           console.log('Using workflow ID:', activeWorkflowId);
           console.log('Workflow source:', workflowSource);
            const fileName = `workflow-pdfs/${Date.now()}-${pageFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('pdfs').upload(fileName, pageFile, { upsert: true });

            if (uploadError) {
             console.error('Storage upload error:', uploadError);
              throw new Error(`Failed to upload PDF to storage: ${uploadError.message}`);
            }
           console.log('PDF uploaded to storage:', uploadData.path);
            
            const extractedDataFileName = `extracted-data/${Date.now()}-extracted-data.json`;
            const extractedDataToUpload = JSON.stringify(transformResult.extractedData) || '{}';
            
            const { data: extractedDataUpload, error: extractedDataError } = await supabase.storage
              .from('pdfs')
              .upload(extractedDataFileName, new Blob([extractedDataToUpload], { type: 'application/json' }), { upsert: true });

            if (extractedDataError) {
             console.error('Extracted data upload error:', extractedDataError);
              throw new Error(`Failed to upload extracted data to storage: ${extractedDataError.message}`);
            }
           console.log('Extracted data uploaded to storage:', extractedDataUpload.path);
            
            const workflowRequestBody = {
              extractedData: JSON.stringify(transformResult.extractedData),
              extractedDataStoragePath: extractedDataUpload.path,
              workflowId: activeWorkflowId,
              userId: user?.id,
              transformationTypeId: pageTransformationType.id,
              pdfFilename: transformResult.newFilename,
              extractionTypeFilename: pageTransformationType.filenameTemplate,
              pageGroupFilenameTemplate: currentGroupConfig?.filenameTemplate,
              pdfPages: 1,
              pdfStoragePath: uploadData.path,
              originalPdfFilename: pageFile.name,
              pdfBase64: pdfBase64,
              formatType: 'JSON', // Transformations are always JSON-based
              sessionId: sessionId,
              groupOrder: currentGroupConfig?.groupOrder || null
            };
           console.log('=== WORKFLOW REQUEST ===');
           console.log('Workflow request body (extractedData):', JSON.stringify(transformResult.extractedData));
           console.log('Workflow request body:', workflowRequestBody);

            // Transformations use the dedicated transform-workflow-processor
            const workflowResponse = await fetch(`${supabaseUrl}/functions/v1/transform-workflow-processor`, {
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
          console.log('===============================================');
          console.error(`ERROR [handleTransformAll]: PAGE ${pageIndex + 1} PROCESSING ERROR - ${sessionId}`);
          console.log('===============================================');
          console.error(`ERROR [handleTransformAll]: Error type: ${error instanceof Error ? error.constructor.name : typeof error} - ${sessionId}`);
          console.error(`ERROR [handleTransformAll]: Error message: ${error instanceof Error ? error.message : String(error)} - ${sessionId}`);
          if (error instanceof Error && error.stack) {
            console.error(`ERROR [handleTransformAll]: Stack trace: ${error.stack} - ${sessionId}`);
          }

          // Update results with error
          console.log(`TRACE [handleTransformAll]: Updating transformAllResults with error for page ${pageIndex} - ${sessionId}`);
          setTransformAllResults(prev => {
            console.log(`TRACE [handleTransformAll]: Error state update callback - prev array length: ${prev.length} - ${sessionId}`);
            const newResults = prev.map(result => {
              if (result.pageIndex === pageIndex) {
                console.log(`TRACE [handleTransformAll]: Setting error for page ${pageIndex} - ${sessionId}`);
                return {
                  ...result,
                  success: false,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  completed: true,
                  transformationType: pageTransformationType,
                  detectionResult: result.detectionResult
                };
              }
              return result;
            });
            console.log(`TRACE [handleTransformAll]: Returning error results array, length: ${newResults.length} - ${sessionId}`);
            return newResults;
          });

          console.log(`TRACE [handleTransformAll]: Calling handleProcessComplete with error - ${sessionId}`);
          handleProcessComplete(pageIndex, { success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        }
        
        const pageEndTime = Date.now();
        console.log(`INFO [handleTransformAll]: Page ${pageIndex + 1} completed in ${pageEndTime - pageStartTime}ms - ${sessionId}`);

        if (pageIndex < pdfPages.length - 1) {
          console.log(`TRACE [handleTransformAll]: Waiting 1000ms before next page - ${sessionId}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const sessionEndTime = Date.now();
      console.log('===============================================');
      console.log(`INFO [handleTransformAll]: SESSION COMPLETE - ${sessionId}`);
      console.log(`INFO [handleTransformAll]: Total time: ${sessionEndTime - sessionStartTime}ms`);
      console.log('===============================================');

    } catch (loopError) {
      console.log('===============================================');
      console.error(`ERROR [handleTransformAll]: CRITICAL ERROR IN MAIN LOOP - ${sessionId}`);
      console.log('===============================================');
      console.error(`ERROR [handleTransformAll]: Loop error type: ${loopError instanceof Error ? loopError.constructor.name : typeof loopError}`);
      console.error(`ERROR [handleTransformAll]: Loop error message: ${loopError instanceof Error ? loopError.message : String(loopError)}`);
      if (loopError instanceof Error && loopError.stack) {
        console.error(`ERROR [handleTransformAll]: Stack trace: ${loopError.stack}`);
      }
      throw loopError;
    } finally {
      console.log(`TRACE [handleTransformAll]: Finally block - cleaning up - ${sessionId}`);
      console.log(`TRACE [handleTransformAll]: Setting isTransformingAll to false - ${sessionId}`);
      setIsTransformingAll(false);
      console.log(`TRACE [handleTransformAll]: Setting currentProcessingPage to null - ${sessionId}`);
      setCurrentProcessingPage(null);
      console.log(`INFO [handleTransformAll]: Cleanup complete - ${sessionId}`);
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
      {/* Page Group Display - Show when page groups are configured */}
      {pageGroupConfigs && pageGroupConfigs.length > 0 && (
        <div className="space-y-6 mb-8">
          {/* Grouped Documents Header */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-lg">
                  <Layers className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {(manuallyEditedPdfPages || pdfPages).length} Grouped Document{(manuallyEditedPdfPages || pdfPages).length !== 1 ? 's' : ''} Ready
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    PDF split into {(manuallyEditedPdfPages || pdfPages).length} group{(manuallyEditedPdfPages || pdfPages).length !== 1 ? 's' : ''} based on {manuallyEditedGroups ? 'manually corrected' : 'manual page group configuration'}
                  </p>
                  {manuallyEditedGroups && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      ✓ Manual corrections applied
                    </p>
                  )}
                  {pageRangeInfo && !manuallyEditedGroups && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Using {pageRangeInfo.usedPages.length} of {pageRangeInfo.totalPages} pages from original PDF
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleOpenManualEditor}
                  disabled={isTransformingAll || isDetectingTypes}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 disabled:cursor-not-allowed"
                >
                  <Edit3 className="h-5 w-5" />
                  <span>Edit Groups</span>
                </button>
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
                        Processing Group {currentProcessingPage !== null ? currentProcessingPage + 1 : '...'} of {manuallyEditedPdfPages ? manuallyEditedPdfPages.length : pdfPages.length}
                      </span>
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      <span>Transform All Groups</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Individual Group Cards */}
          <div className="grid grid-cols-1 gap-4">
            {(manuallyEditedPdfPages || pdfPages).map((groupFile, groupIndex) => {
              const groupConfig = manuallyEditedGroups
                ? manuallyEditedGroups[groupIndex]?.pageGroupConfig
                : pageGroupConfigs[groupIndex];
              const groupResult = transformAllResults[groupIndex];

              // Extract page range from filename (format: _pages_X-Y.pdf or _page_X.pdf)
              const pageRangeMatch = groupFile.name.match(/_pages?_(\d+)(?:-(\d+))?\.pdf/);
              const pageStart = pageRangeMatch ? parseInt(pageRangeMatch[1]) : null;
              const pageEnd = pageRangeMatch && pageRangeMatch[2] ? parseInt(pageRangeMatch[2]) : pageStart;

              return (
                <div
                  key={groupIndex}
                  className={`bg-white dark:bg-gray-800 border rounded-xl p-6 shadow-sm transition-all ${
                    groupResult?.completed
                      ? groupResult.success
                        ? 'border-green-300 dark:border-green-600'
                        : 'border-red-300 dark:border-red-600'
                      : currentProcessingPage === groupIndex
                        ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold ${
                        groupResult?.completed
                          ? groupResult.success
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                          : currentProcessingPage === groupIndex
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {groupResult?.completed ? (
                          groupResult.success ? <CheckCircle className="h-6 w-6" /> : <XCircle className="h-6 w-6" />
                        ) : currentProcessingPage === groupIndex ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          groupIndex + 1
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            Group {groupIndex + 1}
                          </h4>
                          {pageStart !== null && (
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-medium rounded">
                              {pageStart === pageEnd ? `Page ${pageStart}` : `Pages ${pageStart}-${pageEnd}`}
                            </span>
                          )}
                          {groupConfig && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                              {groupConfig.pagesPerGroup} page{groupConfig.pagesPerGroup !== 1 ? 's' : ''} per group
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" />
                            <span className="font-mono text-xs">{groupFile.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>Size: {(groupFile.size / 1024).toFixed(1)} KB</span>
                          </div>
                          {groupResult?.transformationType && (
                            <div className="flex items-center space-x-2">
                              <span>Type: {groupResult.transformationType.name}</span>
                            </div>
                          )}
                        </div>

                        {currentProcessingPage === groupIndex && !groupResult?.completed && (
                          <div className="mt-3 flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm font-medium">Processing...</span>
                          </div>
                        )}

                        {groupResult?.completed && groupResult.success && groupResult.newFilename && (
                          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                            <div className="text-sm text-green-800 dark:text-green-300">
                              <span className="font-medium">Generated File: </span>
                              <span className="font-mono">{groupResult.newFilename}</span>
                            </div>
                          </div>
                        )}

                        {groupResult?.completed && !groupResult.success && groupResult.error && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                            <div className="text-sm text-red-800 dark:text-red-300">
                              <span className="font-medium">Error: </span>
                              <span>{groupResult.error}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transform All Results Summary */}
          {transformAllResults.length > 0 && transformAllResults.every(r => r.completed) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-blue-800 dark:text-blue-300 text-lg">
                  Processing Complete
                </h4>
                <button
                  onClick={() => setTransformAllResults([])}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors duration-200"
                >
                  Clear Results
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {transformAllResults.filter(r => r.success).length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Successful</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {transformAllResults.filter(r => !r.success).length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
          {/* Only show individual page cards when NOT using manual page groupings */}
          {!(pageGroupConfigs && pageGroupConfigs.length > 0) && (
            <>
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
                    pageGroupConfig={undefined}
                    onProcessStart={handleProcessStart}
                    onProcessComplete={handleProcessComplete}
                    hidePreview={user?.role === 'vendor'}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Manual Group Editor Modal */}
      {pageGroupConfigs && pageGroupConfigs.length > 0 && showManualEditor && (
        <ManualGroupEditor
          isOpen={showManualEditor}
          onClose={handleCloseManualEditor}
          totalPages={pageRangeInfo?.totalPages || pdfPages.length}
          currentGroups={pdfPages.map((pageFile, idx) => {
            const pageRangeMatch = pageFile.name.match(/_pages?_(\d+)(?:-(\d+))?\.pdf/);
            const pageStart = pageRangeMatch ? parseInt(pageRangeMatch[1]) : idx + 1;
            const pageEnd = pageRangeMatch && pageRangeMatch[2] ? parseInt(pageRangeMatch[2]) : pageStart;
            const pages: number[] = [];
            for (let i = pageStart; i <= pageEnd; i++) {
              pages.push(i);
            }
            return {
              groupIndex: idx,
              pages,
              pageGroupConfig: pageGroupConfigs[idx] || {
                id: `temp-${idx}`,
                transformationTypeId: fallbackTransformationType.id,
                groupOrder: idx + 1,
                pagesPerGroup: pages.length,
                processMode: 'all' as const
              }
            };
          })}
          onSave={handleSaveManualEdits}
        />
      )}
    </div>
  );
}