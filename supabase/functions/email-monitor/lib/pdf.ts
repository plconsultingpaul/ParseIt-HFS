import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { Buffer } from 'node:buffer';
import { SplitPageResult, ExtractionType, PdfAttachment } from '../index.ts';

export async function splitPdfIntoPages(
  attachment: { filename: string; base64: string },
  extractionType: ExtractionType
): Promise<SplitPageResult[]> {
  const jsonMultiPageProcessing = extractionType.json_multi_page_processing;

  if (jsonMultiPageProcessing === true) {
    console.log('json_multi_page_processing is TRUE - processing all pages as one document');
    return [{
      filename: attachment.filename,
      base64: attachment.base64,
      pageNumber: 0,
      originalFilename: attachment.filename
    }];
  }

  console.log('json_multi_page_processing is FALSE - splitting PDF into individual pages');

  const pdfBuffer = Buffer.from(attachment.base64, 'base64');
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();

  console.log(`Total pages in PDF: ${totalPages}`);

  const results: SplitPageResult[] = [];
  const baseFilename = attachment.filename.replace('.pdf', '').replace('.PDF', '');

  for (let i = 0; i < totalPages; i++) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
    singlePageDoc.addPage(copiedPage);
    const pdfBytes = await singlePageDoc.save();
    const base64Data = Buffer.from(pdfBytes).toString('base64');

    results.push({
      filename: `${baseFilename}_page_${i + 1}.pdf`,
      base64: base64Data,
      pageNumber: i + 1,
      originalFilename: attachment.filename
    });
  }

  console.log(`Split PDF into ${results.length} separate pages for processing`);
  return results;
}

export async function getPdfPageCount(base64Data: string): Promise<number> {
  try {
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.warn('Could not determine PDF page count:', (error as Error).message);
    return 1;
  }
}
