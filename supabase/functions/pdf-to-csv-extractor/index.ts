import { GoogleGenerativeAI } from "@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FieldMapping {
  fieldName: string;
  type: "ai" | "mapped" | "hardcoded";
  value: string;
  dataType?: "string" | "number" | "integer" | "datetime" | "phone" | "boolean";
  maxLength?: number;
}

interface ExtractionRequest {
  pdfBase64?: string;
  pdfBase64Array?: string[];
  apiKey: string;
  fieldMappings: FieldMapping[];
  instructions: string;
  rowDetectionInstructions: string;
  delimiter?: string;
  includeHeaders?: boolean;
}

function escapeCsvValue(value: any, delimiter: string = ','): string {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);
  const needsQuoting =
    stringValue.includes(delimiter) ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r');

  if (needsQuoting) {
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return stringValue;
}

function generateCsvHeader(fieldMappings: FieldMapping[], delimiter: string): string {
  const headers = fieldMappings.map(mapping => mapping.fieldName);
  return headers.map(header => escapeCsvValue(header, delimiter)).join(delimiter);
}

function generateCsvRow(rowData: any, fieldMappings: FieldMapping[], delimiter: string): string {
  const values = fieldMappings.map(mapping => {
    const value = rowData[mapping.fieldName];

    if (value === null || value === undefined) {
      return '';
    }

    const dataType = mapping.dataType || 'string';

    switch (dataType) {
      case 'number':
      case 'integer':
        if (typeof value === 'number') {
          return String(value);
        }
        const numValue = parseFloat(String(value));
        return isNaN(numValue) ? '' : String(numValue);

      case 'boolean':
        return value ? 'true' : 'false';

      case 'datetime':
        return escapeCsvValue(value, delimiter);

      case 'phone':
        const cleanPhone = String(value).replace(/[^0-9+\-() ]/g, '');
        return escapeCsvValue(cleanPhone, delimiter);

      case 'string':
      default:
        let stringValue = String(value);
        if (mapping.maxLength && stringValue.length > mapping.maxLength) {
          stringValue = stringValue.substring(0, mapping.maxLength);
        }
        return escapeCsvValue(stringValue, delimiter);
    }
  });

  return values.join(delimiter);
}

Deno.serve(async (req: Request) => {
  const requestStartTime = performance.now();

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  console.log('\n[EdgeFunction] ============================================');
  console.log('[EdgeFunction] 🚀 === PDF TO CSV EXTRACTOR START ===');
  console.log('[EdgeFunction] Timestamp:', new Date().toISOString());
  console.log('[EdgeFunction] Request method:', req.method);
  console.log('[EdgeFunction] Request URL:', req.url);

  try {
    console.log('[EdgeFunction] Parsing request body...');
    const parseStartTime = performance.now();
    const requestData: ExtractionRequest = await req.json();
    const parseEndTime = performance.now();
    console.log(`[EdgeFunction] Request parsed in ${((parseEndTime - parseStartTime) / 1000).toFixed(3)}s`);

    console.log('[EdgeFunction] 📥 Request details:');
    console.log('[EdgeFunction] - Field mappings count:', requestData.fieldMappings?.length || 0);
    console.log('[EdgeFunction] - Single PDF mode:', !!requestData.pdfBase64);
    console.log('[EdgeFunction] - Multi-page PDF mode:', !!requestData.pdfBase64Array);
    console.log('[EdgeFunction] - PDF count:', requestData.pdfBase64Array?.length || 1);
    console.log('[EdgeFunction] - Row detection instructions length:', requestData.rowDetectionInstructions?.length || 0);
    console.log('[EdgeFunction] - Delimiter:', JSON.stringify(requestData.delimiter || ','));
    console.log('[EdgeFunction] - Include headers:', requestData.includeHeaders !== false);

    // Validate that we have either single PDF or array of PDFs
    if ((!requestData.pdfBase64 && !requestData.pdfBase64Array) || !requestData.apiKey || !requestData.fieldMappings || requestData.fieldMappings.length === 0) {
      console.error('[EdgeFunction] ❌ Validation failed: Missing required fields');
      console.error('[EdgeFunction] - Has pdfBase64:', !!requestData.pdfBase64);
      console.error('[EdgeFunction] - Has pdfBase64Array:', !!requestData.pdfBase64Array);
      console.error('[EdgeFunction] - Has apiKey:', !!requestData.apiKey);
      console.error('[EdgeFunction] - Field mappings count:', requestData.fieldMappings?.length || 0);
      return new Response(
        JSON.stringify({ error: "Missing required fields: (pdfBase64 or pdfBase64Array), apiKey, and fieldMappings are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const delimiter = requestData.delimiter || ',';
    const includeHeaders = requestData.includeHeaders !== false;

    console.log('[EdgeFunction] Initializing Gemini AI...');
    const initStartTime = performance.now();
    const genAI = new GoogleGenerativeAI(requestData.apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const initEndTime = performance.now();
    console.log(`[EdgeFunction] Gemini initialized in ${((initEndTime - initStartTime) / 1000).toFixed(3)}s`);

    const fieldDescriptions = requestData.fieldMappings
      .filter(m => m.type === 'ai')
      .map(m => `- ${m.fieldName}: ${m.value || 'extract this field'}`)
      .join('\n');

    const hardcodedFields = requestData.fieldMappings
      .filter(m => m.type === 'hardcoded')
      .map(m => `- ${m.fieldName}: always set to "${m.value}"`)
      .join('\n');

    const isMultiPage = requestData.pdfBase64Array && requestData.pdfBase64Array.length > 1;
    const pageInfo = isMultiPage
      ? `You are analyzing ${requestData.pdfBase64Array.length} PDF pages that should be processed together as a single document.`
      : 'You are analyzing a PDF document to extract data into CSV format.';

    const prompt = `${pageInfo}

ROW DETECTION INSTRUCTIONS:
${requestData.rowDetectionInstructions || 'Extract each logical record as a separate row'}
${isMultiPage ? '\n⚠️ IMPORTANT: Process ALL pages together. Extract rows from ALL pages in the order they appear. Do not stop after processing just one page.' : ''}

EXTRACTION INSTRUCTIONS:
${requestData.instructions}

FIELDS TO EXTRACT (for each row):
${fieldDescriptions}

${hardcodedFields ? `HARDCODED FIELDS (always include these with the specified values):\n${hardcodedFields}\n` : ''}

IMPORTANT RULES:
1. Identify all rows in the document based on the row detection instructions
2. Extract data for EVERY field listed above for EACH row
3. Return your response as a JSON array where each element represents one row
4. Each row should be a JSON object with keys matching the field names exactly
5. If a field value is not found in the PDF, use null
6. For hardcoded fields, always use the exact value specified
7. Extract ALL rows from the document - do not skip any
8. Maintain data accuracy - extract exactly what you see in the PDF

Example response format:
[
  {
    "fieldName1": "value1",
    "fieldName2": "value2",
    "fieldName3": "value3"
  },
  {
    "fieldName1": "value4",
    "fieldName2": "value5",
    "fieldName3": "value6"
  }
]

Please analyze the PDF and return the extracted data as a JSON array.`;

    console.log('[EdgeFunction] 📤 Preparing to send request to Gemini AI');
    console.log('[EdgeFunction] Prompt length:', prompt.length, 'characters');
    console.log('[EdgeFunction] Content parts:', contentParts.length);
    console.log('[EdgeFunction] ⏱️  Calling Gemini API (this typically takes 20-90 seconds)...');

    // Build the content array for Gemini - support both single and multi-page PDFs
    const contentParts: any[] = [];

    if (requestData.pdfBase64Array && requestData.pdfBase64Array.length > 0) {
      // Multi-page mode: add all PDFs
      console.log('Processing multiple PDFs:', requestData.pdfBase64Array.length);
      for (let i = 0; i < requestData.pdfBase64Array.length; i++) {
        const pdfData = requestData.pdfBase64Array[i].replace(/^data:application\/pdf;base64,/, '');
        contentParts.push({
          inlineData: {
            mimeType: "application/pdf",
            data: pdfData
          }
        });
      }
    } else if (requestData.pdfBase64) {
      // Single page mode: add single PDF
      console.log('Processing single PDF');
      const pdfData = requestData.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      contentParts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: pdfData
        }
      });
    }

    // Add the prompt
    contentParts.push(prompt);

    const geminiStartTime = performance.now();
    console.log('[EdgeFunction] Gemini API call starting at:', new Date().toISOString());
    const result = await model.generateContent(contentParts);
    const geminiEndTime = performance.now();
    const geminiDuration = ((geminiEndTime - geminiStartTime) / 1000).toFixed(2);
    console.log(`[EdgeFunction] ✅ Gemini API responded in ${geminiDuration}s`);

    const response = await result.response;
    const text = response.text();

    console.log('[EdgeFunction] 📥 Gemini response details:');
    console.log('[EdgeFunction] Response length:', text.length, 'characters');
    console.log('[EdgeFunction] Response preview (first 200 chars):', text.substring(0, 200));

    console.log('[EdgeFunction] Parsing JSON from AI response...');
    const parseJsonStartTime = performance.now();
    let jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('[EdgeFunction] Array pattern not found, trying object pattern...');
      jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log('[EdgeFunction] Found object, converting to array...');
        const parsedObj = JSON.parse(jsonMatch[0]);
        jsonMatch = [`[${JSON.stringify(parsedObj)}]`];
      }
    }

    if (!jsonMatch) {
      console.error('[EdgeFunction] ❌ Could not find valid JSON in AI response');
      console.error('[EdgeFunction] Response text:', text);
      throw new Error('Could not find valid JSON array in AI response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    const parseJsonEndTime = performance.now();
    console.log(`[EdgeFunction] JSON parsed in ${((parseJsonEndTime - parseJsonStartTime) / 1000).toFixed(3)}s`);
    console.log('[EdgeFunction] ✅ Extracted data details:');
    console.log('[EdgeFunction] - Rows extracted:', extractedData.length);
    console.log('[EdgeFunction] - First row keys:', extractedData.length > 0 ? Object.keys(extractedData[0]).join(', ') : 'N/A');

    if (!Array.isArray(extractedData) || extractedData.length === 0) {
      console.error('[EdgeFunction] ❌ Extracted data is invalid');
      console.error('[EdgeFunction] - Is array:', Array.isArray(extractedData));
      console.error('[EdgeFunction] - Length:', extractedData?.length || 0);
      throw new Error('Extracted data is not a valid array or is empty');
    }

    console.log('[EdgeFunction] Applying hardcoded fields...');
    const hardcodedFields = requestData.fieldMappings.filter(m => m.type === 'hardcoded');
    console.log('[EdgeFunction] - Hardcoded fields count:', hardcodedFields.length);
    for (const mapping of hardcodedFields) {
      for (const row of extractedData) {
        row[mapping.fieldName] = mapping.value;
      }
    }

    console.log('[EdgeFunction] Generating CSV...');
    const csvStartTime = performance.now();
    const csvLines: string[] = [];

    if (includeHeaders) {
      csvLines.push(generateCsvHeader(requestData.fieldMappings, delimiter));
    }

    for (const row of extractedData) {
      csvLines.push(generateCsvRow(row, requestData.fieldMappings, delimiter));
    }

    const csvContent = csvLines.join('\n');
    const csvEndTime = performance.now();
    console.log(`[EdgeFunction] CSV generated in ${((csvEndTime - csvStartTime) / 1000).toFixed(3)}s`);

    console.log('[EdgeFunction] ✅ CSV generation successful:');
    console.log('[EdgeFunction] - Total lines:', csvLines.length);
    console.log('[EdgeFunction] - CSV content length:', csvContent.length, 'characters');
    console.log('[EdgeFunction] - CSV size:', (csvContent.length / 1024).toFixed(2), 'KB');

    const requestEndTime = performance.now();
    const totalDuration = ((requestEndTime - requestStartTime) / 1000).toFixed(2);

    console.log('[EdgeFunction] 🎉 === REQUEST COMPLETED SUCCESSFULLY ===');
    console.log(`[EdgeFunction] Total processing time: ${totalDuration}s`);
    console.log('[EdgeFunction] Time breakdown:');
    console.log(`[EdgeFunction]   - Request parsing: ${((parseEndTime - parseStartTime) / 1000).toFixed(3)}s`);
    console.log(`[EdgeFunction]   - Gemini initialization: ${((initEndTime - initStartTime) / 1000).toFixed(3)}s`);
    console.log(`[EdgeFunction]   - Gemini API call: ${geminiDuration}s`);
    console.log(`[EdgeFunction]   - JSON parsing: ${((parseJsonEndTime - parseJsonStartTime) / 1000).toFixed(3)}s`);
    console.log(`[EdgeFunction]   - CSV generation: ${((csvEndTime - csvStartTime) / 1000).toFixed(3)}s`);
    console.log('[EdgeFunction] ============================================\n');

    return new Response(
      JSON.stringify({
        success: true,
        csvContent,
        rowCount: extractedData.length,
        fieldCount: requestData.fieldMappings.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    const errorTime = performance.now();
    const errorDuration = ((errorTime - requestStartTime) / 1000).toFixed(2);
    console.error('[EdgeFunction] ❌ === PDF TO CSV EXTRACTION FAILED ===');
    console.error('[EdgeFunction] Error occurred after:', errorDuration, 's');
    console.error('[EdgeFunction] Error type:', error?.constructor?.name || 'Unknown');
    console.error('[EdgeFunction] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[EdgeFunction] Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('[EdgeFunction] Full error object:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        error: "PDF to CSV extraction failed",
        details: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
