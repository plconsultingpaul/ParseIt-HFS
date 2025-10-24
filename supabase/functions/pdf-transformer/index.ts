import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1"
import { PDFDocument } from "npm:pdf-lib@1.17.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface FieldMapping {
  fieldName: string
  type: 'ai' | 'mapped' | 'hardcoded'
  value: string
  dataType?: 'string' | 'number' | 'integer' | 'datetime' | 'boolean'
  maxLength?: number
  pageNumberInGroup?: number
}

interface TransformationRequest {
  pdfBase64: string
  transformationType: {
    id: string
    name: string
    defaultInstructions: string
    filenameTemplate: string
    fieldMappings?: Array<FieldMapping>
  }
  additionalInstructions?: string
  apiKey: string
}

// Helper function to normalize boolean values to proper case (True/False)
function normalizeBooleanValue(value: any): string {
  if (typeof value === 'boolean') {
    return value ? 'True' : 'False'
  }

  if (typeof value === 'string') {
    const lowerValue = value.trim().toLowerCase()

    // Handle common boolean representations
    if (lowerValue === 'true' || lowerValue === 't' || lowerValue === 'yes' || lowerValue === 'y' || lowerValue === '1') {
      return 'True'
    }
    if (lowerValue === 'false' || lowerValue === 'f' || lowerValue === 'no' || lowerValue === 'n' || lowerValue === '0') {
      return 'False'
    }

    // If it's already in proper case format, return as is
    if (value === 'True' || value === 'False') {
      return value
    }
  }

  // Default to False for any other value
  console.warn(`⚠️ Invalid boolean value "${value}", defaulting to False`)
  return 'False'
}

// Helper function to extract a specific page from a PDF
async function extractSpecificPage(pdfBase64: string, pageNumber: number): Promise<string> {
  try {
    console.log(`📄 Extracting page ${pageNumber} from PDF for isolated AI analysis`)

    // Decode base64 to bytes
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const totalPages = pdfDoc.getPageCount()

    console.log(`📄 PDF has ${totalPages} pages, extracting page ${pageNumber}`)

    // Validate page number
    if (pageNumber < 1 || pageNumber > totalPages) {
      console.warn(`⚠️ Invalid page number ${pageNumber} (PDF has ${totalPages} pages), using page 1 as fallback`)
      pageNumber = 1
    }

    // Create a new PDF with only the requested page
    const singlePageDoc = await PDFDocument.create()
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNumber - 1]) // Convert to 0-based index
    singlePageDoc.addPage(copiedPage)

    // Convert back to base64
    const singlePageBytes = await singlePageDoc.save()
    const singlePageBase64 = btoa(String.fromCharCode(...singlePageBytes))

    console.log(`✅ Successfully extracted page ${pageNumber} (size: ${singlePageBase64.length} chars)`)

    return singlePageBase64
  } catch (error) {
    console.error(`❌ Failed to extract page ${pageNumber}:`, error)
    throw new Error(`Failed to extract page ${pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Helper function to group field mappings by page number
function groupFieldsByPage(fieldMappings: FieldMapping[]): Map<number, FieldMapping[]> {
  const pageGroups = new Map<number, FieldMapping[]>()

  for (const mapping of fieldMappings) {
    // Default to page 1 if not specified
    const pageNum = mapping.pageNumberInGroup || 1

    if (!pageGroups.has(pageNum)) {
      pageGroups.set(pageNum, [])
    }

    pageGroups.get(pageNum)!.push(mapping)
  }

  console.log(`📊 Field mappings grouped by page:`)
  for (const [pageNum, fields] of pageGroups.entries()) {
    console.log(`   Page ${pageNum}: ${fields.length} fields - ${fields.map(f => f.fieldName).join(', ')}`)
  }

  return pageGroups
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  console.log('=== PDF TRANSFORMER START ===');
  
  try {
    let requestText: string;
    try {
      requestText = await req.text();
    } catch (readError) {
      console.error('Failed to read request body:', readError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to read request body", 
          details: readError instanceof Error ? readError.message : "Unknown error"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log('Request body size:', requestText.length, 'characters');
    console.log('Request body preview (first 200 chars):', requestText.substring(0, 200));
    console.log('Request body preview (last 200 chars):', requestText.substring(Math.max(0, requestText.length - 200)));
    
    let requestData: TransformationRequest;
    try {
      requestData = JSON.parse(requestText);
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError);
      console.log('Invalid JSON content:', requestText);
      return new Response(
        JSON.stringify({ 
          error: "Invalid JSON in request body", 
          details: parseError instanceof Error ? parseError.message : "Unknown parse error"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { pdfBase64, transformationType, additionalInstructions, apiKey } = requestData;
    
    console.log('PDF base64 length:', pdfBase64?.length || 0);
    console.log('Transformation type:', transformationType?.name);
    console.log('API key present:', !!apiKey);

    if (!apiKey) {
      throw new Error('Google Gemini API key not configured')
    }

    if (!transformationType) {
      throw new Error('Transformation type not provided')
    }

    console.log('Initializing Gemini AI...');
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })

    // Combine instructions
    const fullInstructions = additionalInstructions
      ? `${transformationType.defaultInstructions}\n\nAdditional Instructions: ${additionalInstructions}`
      : transformationType.defaultInstructions

    console.log('Full instructions length:', fullInstructions.length);

    // NEW APPROACH: Process fields page by page to ensure accurate extraction
    console.log('=== PAGE-AWARE FIELD EXTRACTION ===')

    let extractedData: any = {}

    if (transformationType.fieldMappings && transformationType.fieldMappings.length > 0) {
      console.log('Processing field mappings:', transformationType.fieldMappings.length);

      // First, handle all hardcoded fields (no AI needed)
      for (const mapping of transformationType.fieldMappings) {
        if (mapping.type === 'hardcoded') {
          console.log(`✓ Hardcoded field "${mapping.fieldName}": ${mapping.value}`)
          // Apply boolean normalization for hardcoded boolean fields
          if (mapping.dataType === 'boolean') {
            extractedData[mapping.fieldName] = normalizeBooleanValue(mapping.value)
          } else if (mapping.dataType === 'string' || !mapping.dataType) {
            // Convert hardcoded string fields to uppercase
            extractedData[mapping.fieldName] = typeof mapping.value === 'string' && mapping.value !== ''
              ? mapping.value.toUpperCase()
              : mapping.value
          } else {
            extractedData[mapping.fieldName] = mapping.value
          }
        }
      }

      // Group remaining fields by page number for AI extraction
      const aiFields = transformationType.fieldMappings.filter(m => m.type === 'ai' || m.type === 'mapped')

      if (aiFields.length > 0) {
        const pageGroups = groupFieldsByPage(aiFields)

        // Process each page group separately
        for (const [pageNum, pageFields] of pageGroups.entries()) {
          console.log(`\n📄 Processing Page ${pageNum} with ${pageFields.length} fields`)

          // Extract the specific page from the PDF
          const pageSpecificPdfBase64 = await extractSpecificPage(pdfBase64, pageNum)

          // Build field mapping instructions for this specific page
          let fieldMappingInstructions = '\n\nFIELD EXTRACTION INSTRUCTIONS:\n'
          fieldMappingInstructions += `IMPORTANT: You are analyzing a single page extracted from a larger document. Extract ONLY from the content visible on THIS page.\n\n`

          pageFields.forEach(mapping => {
            if (mapping.type === 'mapped') {
              const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                                  mapping.dataType === 'number' ? ' (format as number)' :
                                  mapping.dataType === 'integer' ? ' (format as integer)' :
                                  mapping.dataType === 'datetime' ? ' (format as datetime in yyyy-MM-ddThh:mm:ss format)' :
                                  mapping.dataType === 'boolean' ? ' (format as boolean: respond with ONLY "True" or "False" in proper case - capital T or F, lowercase remaining letters)' : ''
              fieldMappingInstructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`
            } else {
              // AI type
              const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                                  mapping.dataType === 'number' ? ' (format as number)' :
                                  mapping.dataType === 'integer' ? ' (format as integer)' :
                                  mapping.dataType === 'datetime' ? ' (format as datetime in yyyy-MM-ddThh:mm:ss format)' :
                                  mapping.dataType === 'boolean' ? ' (format as boolean: respond with ONLY "True" or "False" in proper case - capital T or F, lowercase remaining letters)' : ''
              fieldMappingInstructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}\n`
            }
          })

          const pagePrompt = `
You are a data extraction AI analyzing a single page from a PDF document. Please analyze the provided page and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}${fieldMappingInstructions}

OUTPUT FORMAT:
Please format the extracted data as JSON with the following structure:
{
  "extractedData": {
    // Include ONLY the fields requested above
  }
}

IMPORTANT GUIDELINES:
1. You are seeing ONLY page ${pageNum} of this document - extract information from THIS page only
2. Only extract information that is clearly visible on THIS page
3. If a field is not found on this page, use empty string ("") for text fields, 0 for numbers, null for optional fields
4. For datetime fields, use the format yyyy-MM-ddThh:mm:ss (e.g., "2024-03-15T14:30:00")
5. For boolean fields, respond with ONLY "True" or "False" (proper case: capital first letter, lowercase remaining)
6. CRITICAL: For all string data type fields, convert the extracted value to UPPER CASE before including it in the output
7. Be precise and accurate with the extracted data
8. Ensure all field names match exactly what's needed

Please provide only the JSON output without any additional explanation or formatting.
`

          console.log(`🤖 Calling Gemini AI for Page ${pageNum}...`)
          console.log(`   Fields to extract: ${pageFields.map(f => f.fieldName).join(', ')}`)

          const result = await model.generateContent([
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: pageSpecificPdfBase64
              }
            },
            pagePrompt
          ])

          const response = await result.response
          let extractedContent = response.text()

          console.log(`✅ Page ${pageNum} AI response received (length: ${extractedContent.length})`)

          // Clean up the response
          extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

          // Parse and merge with existing data
          try {
            const parsedResponse = JSON.parse(extractedContent)
            const pageData = parsedResponse.extractedData || parsedResponse || {}

            // Apply boolean normalization and string uppercase conversion
            pageFields.forEach(field => {
              if (field.dataType === 'boolean' && pageData.hasOwnProperty(field.fieldName)) {
                pageData[field.fieldName] = normalizeBooleanValue(pageData[field.fieldName])
              } else if ((field.dataType === 'string' || !field.dataType) && pageData.hasOwnProperty(field.fieldName)) {
                // Convert string fields to uppercase
                if (typeof pageData[field.fieldName] === 'string' && pageData[field.fieldName] !== '') {
                  pageData[field.fieldName] = pageData[field.fieldName].toUpperCase()
                }
              }
            })

            // Merge page-specific data into final result
            Object.assign(extractedData, pageData)

            console.log(`✅ Page ${pageNum} data extracted successfully:`, Object.keys(pageData).join(', '))
          } catch (parseError) {
            console.error(`❌ Failed to parse Page ${pageNum} response:`, parseError)
            // Set empty values for failed fields
            pageFields.forEach(field => {
              if (!extractedData.hasOwnProperty(field.fieldName)) {
                extractedData[field.fieldName] = ''
              }
            })
          }
        }
      }
    } else {
      // No field mappings - use legacy single-pass extraction
      console.log('⚠️ No field mappings defined, using legacy extraction mode')

      const prompt = `
You are a data extraction AI for PDF transformation and renaming. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}

OUTPUT FORMAT:
Please format the extracted data as JSON with the following structure:
{
  "extractedData": {
    // Include all the fields needed for the filename template
  }
}

IMPORTANT GUIDELINES:
1. Only extract information that is clearly visible in the document
2. If a field is not found, use empty string ("") for text fields, 0 for numbers, null for optional fields
3. For datetime fields, use the format yyyy-MM-ddThh:mm:ss (e.g., "2024-03-15T14:30:00")
4. Be precise and accurate with the extracted data
5. The extracted data will be used to rename the PDF file using the template: ${transformationType.filenameTemplate}
6. Ensure all field names match exactly what's needed for the filename template

Please provide only the JSON output without any additional explanation or formatting.
`

      console.log('Prompt length:', prompt.length);
      console.log('Calling Gemini AI (legacy mode)...');

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64
          }
        },
        prompt
      ])

      const response = await result.response
      let extractedContent = response.text()

      console.log('=== AI RESPONSE ANALYSIS (Legacy) ===')
      console.log('Raw AI response length:', extractedContent.length)

      // Clean up the response
      extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

      // Parse the extracted data
      try {
        const parsedResponse = JSON.parse(extractedContent)
        extractedData = parsedResponse.extractedData || parsedResponse || {}

        // Ensure extractedData is always a valid object
        if (typeof extractedData !== 'object' || extractedData === null || Array.isArray(extractedData)) {
          console.warn('Invalid extracted data format, using fallback object')
          extractedData = {}
        }

        // Ensure we have at least some basic data structure
        if (Object.keys(extractedData).length === 0) {
          console.warn('Extracted data is empty, creating fallback structure')
          extractedData = {
            documentType: 'unknown',
            extractionFailed: true,
            originalFilename: 'unknown',
            extractedAt: new Date().toISOString()
          }
        }

      } catch (parseError) {
        console.error('=== CRITICAL JSON PARSE ERROR (Legacy) ===')
        console.error('Parse error:', parseError)

        // Create a valid fallback structure
        extractedData = {
          documentType: 'unknown',
          extractionFailed: true,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown error',
          originalFilename: 'unknown',
          extractedAt: new Date().toISOString()
        }
        console.log('Created fallback extracted data structure')
      }
    }

    console.log('=== FINAL EXTRACTED DATA VALIDATION ===')
    console.log('Final extracted data keys:', Object.keys(extractedData))
    console.log('Final extracted data:', extractedData)
    
    // Validate that the final extracted data can be serialized to JSON
    let finalJsonString: string
    try {
      finalJsonString = JSON.stringify(extractedData)
      console.log('Final JSON serialization successful, length:', finalJsonString.length)
      console.log('Final JSON preview (first 200 chars):', finalJsonString.substring(0, 200))
    } catch (serializeError) {
      console.error('CRITICAL: Cannot serialize extracted data to JSON:', serializeError)
      // Create an even simpler fallback
      extractedData = {
        error: 'Serialization failed',
        message: serializeError.message,
        timestamp: new Date().toISOString()
      }
      finalJsonString = JSON.stringify(extractedData)
      console.log('Created minimal fallback JSON:', finalJsonString)
    }
    
    // Generate new filename using the template
    let newFilename = transformationType.filenameTemplate
    console.log('=== FILENAME GENERATION ===')
    console.log('Original filename template:', newFilename)
    
    // Replace placeholders in filename template with extracted data
    for (const [key, value] of Object.entries(extractedData)) {
      const placeholder = `{{${key}}}`
      if (newFilename.includes(placeholder)) {
        // Clean the value for filename use (remove invalid characters)
        const cleanValue = String(value || '').replace(/[<>:"/\\|?*]/g, '_').trim()
        console.log(`Replacing ${placeholder} with ${cleanValue}`);
        newFilename = newFilename.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), cleanValue)
      }
    }

    // Ensure the filename ends with .pdf
    if (!newFilename.toLowerCase().endsWith('.pdf')) {
      newFilename += '.pdf'
    }

    // Remove any remaining unreplaced placeholders
    newFilename = newFilename.replace(/\{\{[^}]+\}\}/g, 'MISSING')
    
    console.log('Final generated filename:', newFilename);

    console.log('=== PDF TRANSFORMER SUCCESS ===')
    console.log('Returning extracted data size:', JSON.stringify(extractedData).length, 'characters')
    
    const responseData = {
        success: true,
        extractedData: extractedData,
        newFilename: newFilename,
        message: 'PDF transformation completed successfully'
    };
    
    // Validate response can be serialized
    let responseJson: string;
    try {
      responseJson = JSON.stringify(responseData);
      console.log('Response JSON validation successful, length:', responseJson.length);
    } catch (serializeError) {
      console.error('CRITICAL: Cannot serialize response to JSON:', serializeError);
      return new Response(
        JSON.stringify({ 
          error: "Response serialization failed", 
          details: serializeError instanceof Error ? serializeError.message : "Unknown serialization error"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    return new Response(
      responseJson,
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("PDF transformation error:", error)
    console.log('=== PDF TRANSFORMER ERROR ===');
    
    // Provide more detailed error information
    let errorDetails = "Unknown error";
    if (error instanceof Error) {
      errorDetails = error.message;
      
      // Check for specific error types and provide better messages
      if (error.message.includes("Unexpected end of JSON input")) {
        errorDetails = "The AI returned invalid or incomplete JSON data. This usually happens when the PDF content is unclear or the extraction instructions need to be more specific. Please try with a clearer PDF or adjust your transformation instructions.";
      } else if (error.message.includes("JSON.parse")) {
        errorDetails = "The AI returned data that couldn't be processed as valid JSON. Please check your transformation instructions and try again with a clearer PDF document.";
      } else if (error.message.includes("API key")) {
        errorDetails = "Google Gemini API key is missing or invalid. Please check your API configuration in Settings.";
      } else if (error.message.includes("quota") || error.message.includes("rate limit")) {
        errorDetails = "API rate limit exceeded. Please wait a moment and try again.";
      } else if (error.message.includes("overloaded") || error.message.includes("503")) {
        errorDetails = "The AI service is temporarily overloaded. Please wait a moment and try again.";
      }
    }
    
    const errorResponse = { 
      error: "PDF transformation failed", 
      details: errorDetails
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})