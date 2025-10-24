import type { FieldMapping } from '../types';

interface CsvExtractionRequest {
  pdfFile: File;
  defaultInstructions: string;
  additionalInstructions?: string;
  fieldMappings?: FieldMapping[];
  rowDetectionInstructions?: string;
  delimiter?: string;
  includeHeaders?: boolean;
  apiKey: string;
}

export async function extractCsvFromPDF(request: CsvExtractionRequest): Promise<string> {
  const {
    pdfFile,
    defaultInstructions,
    additionalInstructions,
    fieldMappings = [],
    rowDetectionInstructions = 'Extract each logical record as a separate row',
    delimiter = ',',
    includeHeaders = true,
    apiKey
  } = request;

  console.log('=== CSV EXTRACTION START ===');
  console.log('PDF file:', pdfFile.name);
  console.log('Field mappings:', fieldMappings.length);
  console.log('Row detection instructions:', rowDetectionInstructions);

  if (!apiKey) {
    throw new Error('Google API Key is required for CSV extraction');
  }

  if (!fieldMappings || fieldMappings.length === 0) {
    throw new Error('Field mappings are required for CSV extraction');
  }

  const pdfBase64 = await fileToBase64(pdfFile);

  const combinedInstructions = additionalInstructions
    ? `${defaultInstructions}\n\nAdditional context: ${additionalInstructions}`
    : defaultInstructions;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration is missing');
  }

  const requestBody = {
    pdfBase64,
    apiKey,
    fieldMappings,
    instructions: combinedInstructions,
    rowDetectionInstructions,
    delimiter,
    includeHeaders
  };

  console.log('Calling pdf-to-csv-extractor edge function');

  const response = await fetch(`${supabaseUrl}/functions/v1/pdf-to-csv-extractor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || errorData.details || 'CSV extraction failed');
  }

  const result = await response.json();

  console.log('=== CSV EXTRACTION SUCCESS ===');
  console.log('Rows extracted:', result.rowCount);
  console.log('Field count:', result.fieldCount);

  return result.csvContent;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
