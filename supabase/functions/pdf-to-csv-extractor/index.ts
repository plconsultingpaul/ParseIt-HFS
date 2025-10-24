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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  console.log('🚀 === PDF TO CSV EXTRACTOR START ===');

  try {
    const requestData: ExtractionRequest = await req.json();
    console.log('📥 Request received');
    console.log('- Field mappings count:', requestData.fieldMappings?.length || 0);
    console.log('- Single PDF mode:', !!requestData.pdfBase64);
    console.log('- Multi-page PDF mode:', !!requestData.pdfBase64Array);
    console.log('- PDF count:', requestData.pdfBase64Array?.length || 1);
    console.log('- Row detection instructions:', requestData.rowDetectionInstructions?.substring(0, 100) || 'none');

    // Validate that we have either single PDF or array of PDFs
    if ((!requestData.pdfBase64 && !requestData.pdfBase64Array) || !requestData.apiKey || !requestData.fieldMappings || requestData.fieldMappings.length === 0) {
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

    const genAI = new GoogleGenerativeAI(requestData.apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    console.log('🤖 Initializing Gemini AI');

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

    console.log('📤 Sending request to Gemini AI');
    console.log('Prompt length:', prompt.length);

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

    const result = await model.generateContent(contentParts);

    const response = await result.response;
    const text = response.text();

    console.log('📥 Received response from Gemini AI');
    console.log('Response length:', text.length);
    console.log('Response preview:', text.substring(0, 200));

    let jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedObj = JSON.parse(jsonMatch[0]);
        jsonMatch = [`[${JSON.stringify(parsedObj)}]`];
      }
    }

    if (!jsonMatch) {
      throw new Error('Could not find valid JSON array in AI response');
    }

    const extractedData = JSON.parse(jsonMatch[0]);
    console.log('✅ Parsed extracted data');
    console.log('- Rows extracted:', extractedData.length);

    if (!Array.isArray(extractedData) || extractedData.length === 0) {
      throw new Error('Extracted data is not a valid array or is empty');
    }

    for (const mapping of requestData.fieldMappings.filter(m => m.type === 'hardcoded')) {
      for (const row of extractedData) {
        row[mapping.fieldName] = mapping.value;
      }
    }

    const csvLines: string[] = [];

    if (includeHeaders) {
      csvLines.push(generateCsvHeader(requestData.fieldMappings, delimiter));
    }

    for (const row of extractedData) {
      csvLines.push(generateCsvRow(row, requestData.fieldMappings, delimiter));
    }

    const csvContent = csvLines.join('\n');

    console.log('✅ CSV generated successfully');
    console.log('- Total lines:', csvLines.length);
    console.log('- CSV content length:', csvContent.length);

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
    console.error('❌ PDF to CSV extraction failed:', error);
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
