import { PDFDocument } from 'pdf-lib';
import { extractTextFromPdfPages } from './pdfTextExtractor';

export interface PdfSplittingOptions {
  pagesPerGroup?: number;
  documentStartPattern?: string;
  documentStartDetectionEnabled?: boolean;
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