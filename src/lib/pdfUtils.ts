import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { extractTextFromPdfPages } from './pdfTextExtractor';
import { detectPatternWithAI, detectPatternWithAIImage, isTextSufficientForDetection } from './aiSmartDetection';
import { withRetry } from './retryHelper';
import type { PageGroupConfig, ManualGroupEdit } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

async function renderPdfPageToBase64(pdfFile: File, pageNumber: number): Promise<string> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageNumber);

  const scale = 2.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get canvas context');
  }

  await page.render({ canvasContext: context, viewport }).promise;

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
}

export interface PdfSplittingOptions {
  pagesPerGroup?: number;
  documentStartPattern?: string;
  documentStartDetectionEnabled?: boolean;
}

export interface PageGroupSplittingOptions {
  pageGroupConfigs?: PageGroupConfig[];
  apiKey?: string;
}

export async function splitPdfIntoLogicalDocuments(
  originalPdfFile: File,
  options: PdfSplittingOptions = {}
): Promise<File[]> {
  const {
    pagesPerGroup = 1,
    documentStartPattern,
    documentStartDetectionEnabled = false
  } = options;

  console.log('🔧 === PDF SPLITTING UTILITY START ===');
  console.log('📄 Original PDF file:', originalPdfFile.name);
  console.log('📊 Splitting options received:', {
    pagesPerGroup,
    documentStartPattern,
    documentStartDetectionEnabled
  });

  try {
    // Load the original PDF
    const arrayBuffer = await originalPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();

    console.log(`📄 PDF has ${totalPages} pages, splitting with options:`, options);
    console.log(`📊 Expected groups with ${pagesPerGroup} pages per group:`, Math.ceil(totalPages / pagesPerGroup));

    let documentBoundaries: number[] = [];

    // Phase 1: Determine document boundaries
    if (documentStartDetectionEnabled && documentStartPattern && documentStartPattern.trim()) {
      console.log('Using pattern-based document detection:', documentStartPattern);
      
      try {
        // Extract text from all pages
        const pageTexts = await extractTextFromPdfPages(originalPdfFile);
        console.log('Extracted text from', pageTexts.length, 'pages');

        // Find pages that contain the start pattern
        const startPageIndices: number[] = [];
        pageTexts.forEach((pageText, index) => {
          if (pageText.toLowerCase().includes(documentStartPattern.toLowerCase())) {
            startPageIndices.push(index); // 0-based index
            console.log(`Found start pattern on page ${index + 1}: "${documentStartPattern}"`);
          }
        });

        if (startPageIndices.length > 0) {
          console.log('Pattern detection found', startPageIndices.length, 'document starts at pages:', startPageIndices.map(i => i + 1));
          
          // Create document boundaries based on detected starts
          for (let i = 0; i < startPageIndices.length; i++) {
            const startPage = startPageIndices[i];
            let endPage: number;
            
            if (i < startPageIndices.length - 1) {
              // Not the last document - end before next start, but respect pagesPerGroup limit
              const nextStart = startPageIndices[i + 1];
              const maxEndByGroup = startPage + pagesPerGroup - 1;
              endPage = Math.min(nextStart - 1, maxEndByGroup);
            } else {
              // Last document - end at pagesPerGroup limit or end of PDF
              endPage = Math.min(startPage + pagesPerGroup - 1, totalPages - 1);
            }
            
            documentBoundaries.push(startPage, endPage);
            console.log(`Document ${i + 1}: pages ${startPage + 1} to ${endPage + 1}`);
          }
        } else {
          console.log('No start pattern found, falling back to fixed grouping');
          // Fall back to fixed grouping if no pattern found
          documentBoundaries = createFixedGroupBoundaries(totalPages, pagesPerGroup);
        }
      } catch (textExtractionError) {
        console.error('Text extraction failed, falling back to fixed grouping:', textExtractionError);
        // Fall back to fixed grouping if text extraction fails
        documentBoundaries = createFixedGroupBoundaries(totalPages, pagesPerGroup);
      }
    } else {
      console.log('Using fixed page grouping:', pagesPerGroup);
      // Use fixed grouping
      documentBoundaries = createFixedGroupBoundaries(totalPages, pagesPerGroup);
    }

    // Phase 2: Create logical document files based on boundaries
    const logicalDocuments: File[] = [];
    
    for (let i = 0; i < documentBoundaries.length; i += 2) {
      const startPage = documentBoundaries[i];
      const endPage = documentBoundaries[i + 1];
      
      console.log(`Creating logical document from pages ${startPage + 1} to ${endPage + 1}`);
      
      // Create a new PDF document for this logical group
      const groupDoc = await PDFDocument.create();
      const pagesToCopy = [];
      
      for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
        pagesToCopy.push(pageIndex);
      }
      
      const copiedPages = await groupDoc.copyPages(pdfDoc, pagesToCopy);
      copiedPages.forEach(page => groupDoc.addPage(page));
      
      // Convert to File object
      const groupPdfBytes = await groupDoc.save();
      const groupFileName = `${originalPdfFile.name.replace('.pdf', '')}_group_${Math.floor(i / 2) + 1}_pages_${startPage + 1}-${endPage + 1}.pdf`;
      const groupFile = new File([groupPdfBytes], groupFileName, {
        type: 'application/pdf'
      });
      
      logicalDocuments.push(groupFile);
    }

    console.log(`Created ${logicalDocuments.length} logical documents`);
    return logicalDocuments;

  } catch (error) {
    console.error('Error splitting PDF into logical documents:', error);
    throw new Error(`Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function createFixedGroupBoundaries(totalPages: number, pagesPerGroup: number): number[] {
  const boundaries: number[] = [];

  for (let startPage = 0; startPage < totalPages; startPage += pagesPerGroup) {
    const endPage = Math.min(startPage + pagesPerGroup - 1, totalPages - 1);
    boundaries.push(startPage, endPage);
  }

  return boundaries;
}

export interface PageGroupResult {
  file: File;
  pageGroupConfig: PageGroupConfig;
  startPage: number;
  endPage: number;
  detectionMethod: 'smart' | 'fixed';
  originalPdfPageStart: number;
  originalPdfPageEnd: number;
}

export async function splitPdfWithPageGroups(
  originalPdfFile: File,
  pageGroupConfigs: PageGroupConfig[],
  apiKey?: string
): Promise<PageGroupResult[]> {
  console.log('🔧 === PDF PAGE GROUP SPLITTING START ===');
  console.log('📄 Original PDF file:', originalPdfFile.name);
  console.log('📊 Page group configs:', pageGroupConfigs.length);
  console.log('🤖 AI detection available:', !!apiKey);

  try {
    const arrayBuffer = await originalPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();

    console.log(`📄 PDF has ${totalPages} pages`);

    const pageTexts = await extractTextFromPdfPages(originalPdfFile);
    console.log('Extracted text from', pageTexts.length, 'pages');

    const results: PageGroupResult[] = [];
    let currentPage = 0;
    const sortedConfigs = pageGroupConfigs.sort((a, b) => a.groupOrder - b.groupOrder);

    while (currentPage < totalPages) {
      let documentSetFound = false;
      const documentSetStartPage = currentPage;

      console.log(`\n🔄 === Starting new document set search from page ${currentPage + 1} ===`);

      for (const groupConfig of sortedConfigs) {
        if (currentPage >= totalPages) {
          console.log(`Reached end of PDF at page ${currentPage + 1}, stopping group detection`);
          break;
        }

        console.log(`\n=== Processing Page Group ${groupConfig.groupOrder} ===`);
        console.log('Config:', {
          pagesPerGroup: groupConfig.pagesPerGroup,
          smartDetectionPattern: groupConfig.smartDetectionPattern,
          processMode: groupConfig.processMode,
          workflowId: groupConfig.workflowId,
          followsPreviousGroup: groupConfig.followsPreviousGroup
        });

        let startPage = currentPage;
        let endPage = currentPage;
        let detectionMethod: 'smart' | 'fixed' = 'fixed';

        if (groupConfig.followsPreviousGroup) {
          console.log('Using "follows previous group" mode - starting at page', currentPage + 1);
          detectionMethod = 'fixed';
          startPage = currentPage;
          documentSetFound = true;

        if (groupConfig.processMode === 'single') {
          endPage = startPage;
          console.log(`Single page mode: using only page ${startPage + 1}`);
        } else {
          console.log('All pages mode: finding next Group 1 boundary or using pagesPerGroup limit');
          let maxEndPage = startPage + groupConfig.pagesPerGroup - 1;

          const nextGroup1Config = pageGroupConfigs.find(cfg =>
            cfg.groupOrder === 1 &&
            (cfg.smartDetectionPattern && cfg.smartDetectionPattern.trim())
          );

          if (nextGroup1Config?.smartDetectionPattern) {
            console.log('Searching for next Group 1 pattern:', nextGroup1Config.smartDetectionPattern);
            const group1PatternLower = nextGroup1Config.smartDetectionPattern.toLowerCase();

            for (let pageIdx = startPage + 1; pageIdx < totalPages && pageIdx <= maxEndPage; pageIdx++) {
              const pageText = pageTexts[pageIdx];
              if (pageText.toLowerCase().includes(group1PatternLower)) {
                console.log(`Found next Group 1 pattern on page ${pageIdx + 1}, limiting current group`);
                maxEndPage = pageIdx - 1;
                break;
              }
            }
          }

          endPage = Math.min(maxEndPage, totalPages - 1);
          console.log(`All pages mode: pages ${startPage + 1} to ${endPage + 1}`);
        }
      } else if (groupConfig.smartDetectionPattern && groupConfig.smartDetectionPattern.trim()) {
        console.log('Using smart detection with pattern:', groupConfig.smartDetectionPattern);
        console.log('AI detection enabled:', groupConfig.useAiDetection);
        console.log('Fallback behavior:', groupConfig.fallbackBehavior || 'skip');
        detectionMethod = 'smart';

        let foundPattern = false;
        const useAI = groupConfig.useAiDetection && apiKey;

        if (useAI) {
          console.log('🤖 Using AI-powered pattern detection');
          const confidenceThreshold = groupConfig.detectionConfidenceThreshold || 0.7;

          for (let pageIdx = currentPage; pageIdx < totalPages; pageIdx++) {
            const pageText = pageTexts[pageIdx];
            const hasEnoughText = isTextSufficientForDetection(pageText);

            try {
              let aiResult;

              if (hasEnoughText) {
                console.log(`Page ${pageIdx + 1}: Using text-based detection (${pageText.length} chars)`);
                aiResult = await withRetry(
                  () => detectPatternWithAI({
                    pageText,
                    pattern: groupConfig.smartDetectionPattern,
                    confidenceThreshold,
                    apiKey: apiKey!
                  }),
                  `AI text detection for page ${pageIdx + 1}`
                );
              } else {
                console.log(`Page ${pageIdx + 1}: Text insufficient (${pageText.length} chars), using image-based detection`);
                const imageBase64 = await renderPdfPageToBase64(originalPdfFile, pageIdx + 1);
                aiResult = await withRetry(
                  () => detectPatternWithAIImage({
                    imageBase64,
                    pattern: groupConfig.smartDetectionPattern,
                    confidenceThreshold,
                    apiKey: apiKey!
                  }),
                  `AI image detection for page ${pageIdx + 1}`
                );
              }

              console.log(`Page ${pageIdx + 1} AI detection: match=${aiResult.match}, confidence=${aiResult.confidence.toFixed(2)}`);
              console.log(`  Reasoning: ${aiResult.reasoning}`);

              if (aiResult.match) {
                console.log(`✅ AI found pattern on page ${pageIdx + 1} (confidence: ${aiResult.confidence.toFixed(2)})`);
                startPage = pageIdx;
                foundPattern = true;
                documentSetFound = true;
                break;
              }
            } catch (aiError) {
              console.error(`AI detection failed for page ${pageIdx + 1}:`, aiError);
              const patternLower = groupConfig.smartDetectionPattern.toLowerCase();
              if (pageText.toLowerCase().includes(patternLower)) {
                console.log(`⚠️ Fallback: Found pattern on page ${pageIdx + 1} using simple text search`);
                startPage = pageIdx;
                foundPattern = true;
                documentSetFound = true;
                break;
              }
            }
          }
        } else {
          // Simple text-based detection
          console.log('📝 Using simple text-based pattern detection');
          const patternLower = groupConfig.smartDetectionPattern.toLowerCase();

          for (let pageIdx = currentPage; pageIdx < totalPages; pageIdx++) {
            const pageText = pageTexts[pageIdx];
            if (pageText.toLowerCase().includes(patternLower)) {
              console.log(`Found pattern on page ${pageIdx + 1}`);
              startPage = pageIdx;
              foundPattern = true;
              documentSetFound = true;
              break;
            }
          }
        }

        if (!foundPattern) {
          const fallbackBehavior = groupConfig.fallbackBehavior || 'skip';
          console.log(`⚠️ Pattern not found. Fallback behavior: ${fallbackBehavior}`);

          if (fallbackBehavior === 'skip') {
            console.log('Skipping this group');
            if (groupConfig.groupOrder === 1) {
              console.log('Group 1 pattern not found, stopping document set search');
              break;
            }
            continue;
          } else if (fallbackBehavior === 'error') {
            throw new Error(`Required pattern not found for group ${groupConfig.groupOrder}: "${groupConfig.smartDetectionPattern}"`);
          } else if (fallbackBehavior === 'fixed_position') {
            console.log('Using fixed position as fallback');
            startPage = currentPage;
            foundPattern = true;
            documentSetFound = true;
            detectionMethod = 'fixed';
          }
        }

        if (!foundPattern) {
          if (groupConfig.groupOrder === 1) {
            console.log('Group 1 pattern not found, stopping document set search');
            break;
          }
          continue;
        }

        if (groupConfig.processMode === 'single') {
          endPage = startPage;
          console.log(`Single page mode: using only page ${startPage + 1}`);
        } else {
          const nextGroupConfig = pageGroupConfigs.find(cfg => cfg.groupOrder > groupConfig.groupOrder);
          let maxEndPage = startPage + groupConfig.pagesPerGroup - 1;

          if (nextGroupConfig?.smartDetectionPattern) {
            const nextPatternLower = nextGroupConfig.smartDetectionPattern.toLowerCase();
            for (let pageIdx = startPage + 1; pageIdx < totalPages && pageIdx <= maxEndPage; pageIdx++) {
              const pageText = pageTexts[pageIdx];
              if (pageText.toLowerCase().includes(nextPatternLower)) {
                console.log(`Found next group pattern on page ${pageIdx + 1}, limiting current group`);
                maxEndPage = pageIdx - 1;
                break;
              }
            }
          }

          endPage = Math.min(maxEndPage, totalPages - 1);
          console.log(`All pages mode: pages ${startPage + 1} to ${endPage + 1}`);
        }
      } else {
        console.log('Using fixed position grouping');
        detectionMethod = 'fixed';
        startPage = currentPage;
        documentSetFound = true;

        if (groupConfig.processMode === 'single') {
          endPage = startPage;
          console.log(`Single page mode: using only page ${startPage + 1}`);
        } else {
          endPage = Math.min(startPage + groupConfig.pagesPerGroup - 1, totalPages - 1);
          console.log(`All pages mode: pages ${startPage + 1} to ${endPage + 1}`);
        }
      }

      const groupDoc = await PDFDocument.create();
      const pagesToCopy = [];

      for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
        pagesToCopy.push(pageIndex);
      }

      const copiedPages = await groupDoc.copyPages(pdfDoc, pagesToCopy);
      copiedPages.forEach(page => groupDoc.addPage(page));

      const groupPdfBytes = await groupDoc.save();
      const groupFileName = `${originalPdfFile.name.replace('.pdf', '')}_group_${groupConfig.groupOrder}_pages_${startPage + 1}-${endPage + 1}.pdf`;
      const groupFile = new File([groupPdfBytes], groupFileName, {
        type: 'application/pdf'
      });

      results.push({
        file: groupFile,
        pageGroupConfig: groupConfig,
        startPage,
        endPage,
        detectionMethod,
        originalPdfPageStart: startPage + 1,
        originalPdfPageEnd: endPage + 1
      });

        currentPage = endPage + 1;
        console.log(`Group ${groupConfig.groupOrder} complete. Next page to process: ${currentPage + 1}`);
      }

      if (!documentSetFound) {
        console.log(`❌ No document set found starting from page ${documentSetStartPage + 1}, ending search`);
        break;
      }

      if (currentPage >= totalPages) {
        console.log(`✅ Reached end of PDF, stopping document set search`);
        break;
      }

      console.log(`✅ Document set complete. Searching for next document set...`);
    }

    console.log(`\n✅ Created ${results.length} page groups from ${totalPages} pages`);
    results.forEach((result, idx) => {
      console.log(`  Group ${idx + 1}: Pages ${result.startPage + 1}-${result.endPage + 1}, Method: ${result.detectionMethod}, Workflow: ${result.pageGroupConfig.workflowId || 'none'}`);
    });

    return results;

  } catch (error) {
    console.error('Error splitting PDF with page groups:', error);
    throw new Error(`Failed to split PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function splitPdfWithManualGroups(
  originalPdfFile: File,
  manualGroups: ManualGroupEdit[]
): Promise<PageGroupResult[]> {
  console.log('🔧 === PDF MANUAL GROUP SPLITTING START ===');
  console.log('📄 Original PDF file:', originalPdfFile.name);
  console.log('📊 Manual groups:', manualGroups.length);

  try {
    const arrayBuffer = await originalPdfFile.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const totalPages = pdfDoc.getPageCount();

    console.log(`📄 PDF has ${totalPages} pages`);

    const results: PageGroupResult[] = [];

    for (const manualGroup of manualGroups.sort((a, b) => a.groupOrder - b.groupOrder)) {
      if (manualGroup.pages.length === 0) {
        console.log(`⚠️ Skipping group ${manualGroup.groupOrder} - no pages assigned`);
        continue;
      }

      console.log(`\n=== Processing Manual Group ${manualGroup.groupOrder} ===`);
      console.log('Pages:', manualGroup.pages.join(', '));

      for (const pageNum of manualGroup.pages) {
        const pageIndex = pageNum - 1;
        if (pageIndex < 0 || pageIndex >= totalPages) {
          const errorMsg = `Invalid page number ${pageNum} in group ${manualGroup.groupOrder}. PDF only has ${totalPages} pages (valid range: 1-${totalPages}).`;
          console.error('❌ Page validation failed:', errorMsg);
          throw new Error(errorMsg);
        }
      }

      const startPage = Math.min(...manualGroup.pages) - 1;
      const endPage = Math.max(...manualGroup.pages) - 1;

      const groupDoc = await PDFDocument.create();
      const pagesToCopy = manualGroup.pages.map(p => p - 1);
      console.log(`📋 Copying page indices from PDF:`, pagesToCopy);

      const copiedPages = await groupDoc.copyPages(pdfDoc, pagesToCopy);
      copiedPages.forEach(page => groupDoc.addPage(page));

      const groupPdfBytes = await groupDoc.save();
      const pagesStr = manualGroup.pages.length === 1
        ? manualGroup.pages[0].toString()
        : `${Math.min(...manualGroup.pages)}-${Math.max(...manualGroup.pages)}`;
      const groupFileName = `${originalPdfFile.name.replace('.pdf', '')}_group_${manualGroup.groupOrder}_pages_${pagesStr}.pdf`;
      const groupFile = new File([groupPdfBytes], groupFileName, {
        type: 'application/pdf'
      });

      results.push({
        file: groupFile,
        pageGroupConfig: manualGroup.pageGroupConfig,
        startPage,
        endPage,
        detectionMethod: 'fixed',
        originalPdfPageStart: Math.min(...manualGroup.pages),
        originalPdfPageEnd: Math.max(...manualGroup.pages)
      });

      console.log(`✅ Group ${manualGroup.groupOrder} complete: ${groupFileName}`);
    }

    console.log(`\n✅ Created ${results.length} manual groups from ${totalPages} pages`);
    results.forEach((result, idx) => {
      console.log(`  Group ${idx + 1}: Pages ${result.originalPdfPageStart}-${result.originalPdfPageEnd}, Workflow: ${result.pageGroupConfig.workflowId || 'none'}`);
    });

    return results;

  } catch (error) {
    console.error('Error splitting PDF with manual groups:', error);
    throw new Error(`Failed to split PDF with manual groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}