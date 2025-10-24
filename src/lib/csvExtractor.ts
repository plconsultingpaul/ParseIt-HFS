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

interface CsvMultiPageExtractionRequest {
  pdfFiles: File[];
  defaultInstructions: string;
  additionalInstructions?: string;
  fieldMappings?: FieldMapping[];
  rowDetectionInstructions?: string;
  delimiter?: string;
  includeHeaders?: boolean;
  apiKey: string;
}

export async function extractCsvFromPDF(request: CsvExtractionRequest): Promise<string> {
  const overallStartTime = performance.now();
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

  console.log('\n[csvExtractor] ============================================');
  console.log('[csvExtractor] === CSV EXTRACTION START ===');
  console.log('[csvExtractor] Timestamp:', new Date().toISOString());
  console.log('[csvExtractor] PDF file:', pdfFile.name);
  console.log('[csvExtractor] File size:', (pdfFile.size / 1024).toFixed(2), 'KB');
  console.log('[csvExtractor] Field mappings:', fieldMappings.length);
  console.log('[csvExtractor] Row detection instructions:', rowDetectionInstructions.substring(0, 100));
  console.log('[csvExtractor] Delimiter:', JSON.stringify(delimiter));
  console.log('[csvExtractor] Include headers:', includeHeaders);

  if (!apiKey) {
    console.error('[csvExtractor] ❌ ERROR: Missing Google API Key');
    throw new Error('Google API Key is required for CSV extraction');
  }

  if (!fieldMappings || fieldMappings.length === 0) {
    console.error('[csvExtractor] ❌ ERROR: No field mappings provided');
    throw new Error('Field mappings are required for CSV extraction');
  }

  console.log('[csvExtractor] Starting file to base64 conversion...');
  const base64StartTime = performance.now();
  const pdfBase64 = await fileToBase64(pdfFile);
  const base64EndTime = performance.now();
  console.log(`[csvExtractor] Base64 conversion completed in ${((base64EndTime - base64StartTime) / 1000).toFixed(2)}s`);
  console.log(`[csvExtractor] Base64 size: ${(pdfBase64.length / 1024).toFixed(2)} KB`);

  const combinedInstructions = additionalInstructions
    ? `${defaultInstructions}\n\nAdditional context: ${additionalInstructions}`
    : defaultInstructions;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[csvExtractor] ❌ ERROR: Missing Supabase configuration');
    throw new Error('Supabase configuration is missing');
  }

  console.log('[csvExtractor] Supabase URL:', supabaseUrl);

  const requestBody = {
    pdfBase64,
    apiKey,
    fieldMappings,
    instructions: combinedInstructions,
    rowDetectionInstructions,
    delimiter,
    includeHeaders
  };

  const requestSize = new Blob([JSON.stringify(requestBody)]).size;
  console.log(`[csvExtractor] Request payload size: ${(requestSize / 1024).toFixed(2)} KB`);

  const fullUrl = `${supabaseUrl}/functions/v1/pdf-to-csv-extractor`;
  console.log('[csvExtractor] Target URL:', fullUrl);
  console.log('[csvExtractor] Has API Key:', !!apiKey);
  console.log('[csvExtractor] Has Supabase Anon Key:', !!supabaseAnonKey);
  console.log('[csvExtractor] Calling pdf-to-csv-extractor edge function...');
  console.log('[csvExtractor] ⏱️  Waiting for Gemini API response (this may take 30-60 seconds)...');

  const fetchStartTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('[csvExtractor] ❌ Request timeout after 120 seconds');
    controller.abort();
  }, 120000);

  let response: Response;
  try {
    console.log('[csvExtractor] About to call fetch()...');
    response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    console.log('[csvExtractor] Fetch completed successfully');
  } catch (fetchError) {
    clearTimeout(timeoutId);
    console.error('[csvExtractor] ❌ Fetch failed immediately!');
    console.error('[csvExtractor] Error name:', fetchError instanceof Error ? fetchError.name : 'Unknown');
    console.error('[csvExtractor] Error message:', fetchError instanceof Error ? fetchError.message : 'Unknown');
    console.error('[csvExtractor] Full error:', fetchError);

    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.error('[csvExtractor] ❌ Request timed out after 120 seconds');
      throw new Error('CSV extraction timed out. The PDF may be too large or complex. Try with a smaller file or fewer field mappings.');
    }
    console.error('[csvExtractor] ❌ Network error - this suggests CORS, network, or edge function deployment issue');
    throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
  }
  clearTimeout(timeoutId);

  const fetchEndTime = performance.now();
  const fetchDuration = ((fetchEndTime - fetchStartTime) / 1000).toFixed(2);
  console.log(`[csvExtractor] Edge function responded in ${fetchDuration}s`);
  console.log(`[csvExtractor] Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    console.error(`[csvExtractor] ❌ ERROR: Edge function returned error status ${response.status}`);
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[csvExtractor] Error details:', errorData);
    throw new Error(errorData.error || errorData.details || 'CSV extraction failed');
  }

  console.log('[csvExtractor] Parsing response JSON...');
  const result = await response.json();

  const overallEndTime = performance.now();
  const totalDuration = ((overallEndTime - overallStartTime) / 1000).toFixed(2);

  console.log('[csvExtractor] ✅ === CSV EXTRACTION SUCCESS ===');
  console.log('[csvExtractor] Rows extracted:', result.rowCount);
  console.log('[csvExtractor] Field count:', result.fieldCount);
  console.log('[csvExtractor] CSV content length:', result.csvContent.length, 'characters');
  console.log(`[csvExtractor] Total extraction time: ${totalDuration}s`);
  console.log('[csvExtractor] Time breakdown:');
  console.log(`[csvExtractor]   - Base64 conversion: ${((base64EndTime - base64StartTime) / 1000).toFixed(2)}s`);
  console.log(`[csvExtractor]   - API call: ${fetchDuration}s`);
  console.log('[csvExtractor] ============================================\n');

  return result.csvContent;
}

export async function extractCsvFromMultiPagePDF(request: CsvMultiPageExtractionRequest): Promise<string> {
  const overallStartTime = performance.now();
  const {
    pdfFiles,
    defaultInstructions,
    additionalInstructions,
    fieldMappings = [],
    rowDetectionInstructions = 'Extract each logical record as a separate row',
    delimiter = ',',
    includeHeaders = true,
    apiKey
  } = request;

  console.log('\n[csvExtractor] ============================================');
  console.log('[csvExtractor] === MULTI-PAGE CSV EXTRACTION START ===');
  console.log('[csvExtractor] Timestamp:', new Date().toISOString());
  console.log('[csvExtractor] PDF files:', pdfFiles.length);
  console.log('[csvExtractor] Total size:', (pdfFiles.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2), 'KB');
  console.log('[csvExtractor] Field mappings:', fieldMappings.length);
  console.log('[csvExtractor] Row detection instructions:', rowDetectionInstructions.substring(0, 100));
  console.log('[csvExtractor] Delimiter:', JSON.stringify(delimiter));
  console.log('[csvExtractor] Include headers:', includeHeaders);

  if (!apiKey) {
    console.error('[csvExtractor] ❌ ERROR: Missing Google API Key');
    throw new Error('Google API Key is required for CSV extraction');
  }

  if (!fieldMappings || fieldMappings.length === 0) {
    console.error('[csvExtractor] ❌ ERROR: No field mappings provided');
    throw new Error('Field mappings are required for CSV extraction');
  }

  if (!pdfFiles || pdfFiles.length === 0) {
    console.error('[csvExtractor] ❌ ERROR: No PDF files provided');
    throw new Error('At least one PDF file is required');
  }

  console.log('[csvExtractor] Starting multi-file base64 conversion...');
  const base64StartTime = performance.now();
  const pdfBase64Array = await Promise.all(
    pdfFiles.map(file => fileToBase64(file))
  );
  const base64EndTime = performance.now();
  console.log(`[csvExtractor] Base64 conversion completed in ${((base64EndTime - base64StartTime) / 1000).toFixed(2)}s`);
  console.log(`[csvExtractor] Total base64 size: ${(pdfBase64Array.reduce((sum, b64) => sum + b64.length, 0) / 1024).toFixed(2)} KB`);

  const combinedInstructions = additionalInstructions
    ? `${defaultInstructions}\n\nAdditional context: ${additionalInstructions}`
    : defaultInstructions;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[csvExtractor] ❌ ERROR: Missing Supabase configuration');
    throw new Error('Supabase configuration is missing');
  }

  console.log('[csvExtractor] Supabase URL:', supabaseUrl);

  const requestBody = {
    pdfBase64Array,
    apiKey,
    fieldMappings,
    instructions: combinedInstructions,
    rowDetectionInstructions,
    delimiter,
    includeHeaders
  };

  const requestSize = new Blob([JSON.stringify(requestBody)]).size;
  console.log(`[csvExtractor] Request payload size: ${(requestSize / 1024).toFixed(2)} KB`);
  console.log('[csvExtractor] Calling pdf-to-csv-extractor edge function with multiple pages...');
  console.log('[csvExtractor] ⏱️  Waiting for Gemini API response (this may take 60-120 seconds for multiple pages)...');

  const fetchStartTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error('[csvExtractor] ❌ Request timeout after 180 seconds');
    controller.abort();
  }, 180000);

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/pdf-to-csv-extractor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      console.error('[csvExtractor] ❌ Multi-page request timed out after 180 seconds');
      throw new Error('Multi-page CSV extraction timed out. The PDFs may be too large or complex. Try processing fewer pages or reducing field mappings.');
    }
    console.error('[csvExtractor] ❌ Network error:', fetchError);
    throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
  }
  clearTimeout(timeoutId);

  const fetchEndTime = performance.now();
  const fetchDuration = ((fetchEndTime - fetchStartTime) / 1000).toFixed(2);
  console.log(`[csvExtractor] Edge function responded in ${fetchDuration}s`);
  console.log(`[csvExtractor] Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    console.error(`[csvExtractor] ❌ ERROR: Edge function returned error status ${response.status}`);
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[csvExtractor] Error details:', errorData);
    throw new Error(errorData.error || errorData.details || 'CSV extraction failed');
  }

  console.log('[csvExtractor] Parsing response JSON...');
  const result = await response.json();

  const overallEndTime = performance.now();
  const totalDuration = ((overallEndTime - overallStartTime) / 1000).toFixed(2);

  console.log('[csvExtractor] ✅ === MULTI-PAGE CSV EXTRACTION SUCCESS ===');
  console.log('[csvExtractor] Total rows extracted:', result.rowCount);
  console.log('[csvExtractor] Field count:', result.fieldCount);
  console.log('[csvExtractor] Pages processed:', pdfFiles.length);
  console.log('[csvExtractor] CSV content length:', result.csvContent.length, 'characters');
  console.log(`[csvExtractor] Total extraction time: ${totalDuration}s`);
  console.log('[csvExtractor] Time breakdown:');
  console.log(`[csvExtractor]   - Base64 conversion: ${((base64EndTime - base64StartTime) / 1000).toFixed(2)}s`);
  console.log(`[csvExtractor]   - API call: ${fetchDuration}s`);
  console.log('[csvExtractor] ============================================\n');

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
