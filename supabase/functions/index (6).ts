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

// Generate unique request ID for tracing
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Helper function to get object size in bytes
function getObjectSize(obj: any): number {
  try {
    return JSON.stringify(obj).length
  } catch {
    return -1
  }
}

// Helper function to check for circular references
function hasCircularReference(obj: any, seen = new WeakSet()): boolean {
  try {
    if (obj === null || typeof obj !== 'object') {
      return false
    }
    if (seen.has(obj)) {
      return true
    }
    seen.add(obj)
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (hasCircularReference(obj[key], seen)) {
          return true
        }
      }
    }
    return false
  } catch (error) {
    console.error('ERROR: Failed to check circular reference:', error)
    return true
  }
}

// Helper function to normalize boolean values to proper case (True/False)
function normalizeBooleanValue(value: any): string {
  console.log(`TRACE [normalizeBooleanValue]: Input value: ${JSON.stringify(value)}, type: ${typeof value}`)

  if (typeof value === 'boolean') {
    const result = value ? 'True' : 'False'
    console.log(`TRACE [normalizeBooleanValue]: Boolean conversion result: ${result}`)
    return result
  }

  if (typeof value === 'string') {
    const lowerValue = value.trim().toLowerCase()
    console.log(`TRACE [normalizeBooleanValue]: String value (lowercased): ${lowerValue}`)

    // Handle common boolean representations
    if (lowerValue === 'true' || lowerValue === 't' || lowerValue === 'yes' || lowerValue === 'y' || lowerValue === '1') {
      console.log(`TRACE [normalizeBooleanValue]: String matched TRUE pattern`)
      return 'True'
    }
    if (lowerValue === 'false' || lowerValue === 'f' || lowerValue === 'no' || lowerValue === 'n' || lowerValue === '0') {
      console.log(`TRACE [normalizeBooleanValue]: String matched FALSE pattern`)
      return 'False'
    }

    // If it's already in proper case format, return as is
    if (value === 'True' || value === 'False') {
      console.log(`TRACE [normalizeBooleanValue]: Already in proper case: ${value}`)
      return value
    }
  }

  // Default to False for any other value
  console.warn(`⚠️ WARNING [normalizeBooleanValue]: Invalid boolean value "${value}", defaulting to False`)
  return 'False'
}

// Configuration for chunked processing to avoid stack overflow
const CHUNK_SIZE = 8192

// Helper function to decode base64 in chunks to avoid stack overflow
function decodeBase64InChunks(base64String: string): Uint8Array {
  const binaryString = atob(base64String)
  const bytes = new Uint8Array(binaryString.length)

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes
}

// Helper function to encode bytes to base64 in chunks to avoid stack overflow
function encodeBase64InChunks(bytes: Uint8Array): string {
  let result = ''

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, Math.min(i + CHUNK_SIZE, bytes.length))
    result += String.fromCharCode(...chunk)
  }

  return btoa(result)
}

// Helper function to extract a specific page from a PDF
async function extractSpecificPage(pdfBase64: string, pageNumber: number): Promise<string> {
  const funcName = 'extractSpecificPage'
  console.log(`INFO [${funcName}]: START - Extracting page ${pageNumber}`)
  console.log(`TRACE [${funcName}]: Input PDF base64 size: ${pdfBase64.length} chars`)

  try {
    console.log(`TRACE [${funcName}]: Decoding base64 to bytes using chunked approach...`)
    const startDecode = Date.now()

    // Decode base64 to bytes using chunked approach
    const pdfBytes = decodeBase64InChunks(pdfBase64)
    console.log(`TRACE [${funcName}]: Base64 decode completed in ${Date.now() - startDecode}ms, resulting bytes: ${pdfBytes.length}`)

    // Load the PDF document
    console.log(`TRACE [${funcName}]: Loading PDF document...`)
    const startLoad = Date.now()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const totalPages = pdfDoc.getPageCount()
    console.log(`TRACE [${funcName}]: PDF loaded in ${Date.now() - startLoad}ms, total pages: ${totalPages}`)

    // Validate page number
    if (pageNumber < 1 || pageNumber > totalPages) {
      console.warn(`WARNING [${funcName}]: Invalid page number ${pageNumber} (PDF has ${totalPages} pages), using page 1 as fallback`)
      pageNumber = 1
    }

    // Create a new PDF with only the requested page
    console.log(`TRACE [${funcName}]: Creating single-page PDF for page ${pageNumber}...`)
    const startCreate = Date.now()
    const singlePageDoc = await PDFDocument.create()
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNumber - 1])
    singlePageDoc.addPage(copiedPage)
    console.log(`TRACE [${funcName}]: Single-page PDF created in ${Date.now() - startCreate}ms`)

    // Convert back to base64 using chunked approach
    console.log(`TRACE [${funcName}]: Saving and encoding single-page PDF using chunked approach...`)
    const startSave = Date.now()
    const singlePageBytes = await singlePageDoc.save()
    console.log(`TRACE [${funcName}]: PDF saved, size: ${singlePageBytes.length} bytes`)

    const singlePageBase64 = encodeBase64InChunks(singlePageBytes)
    console.log(`TRACE [${funcName}]: Single-page PDF encoded in ${Date.now() - startSave}ms, size: ${singlePageBase64.length} chars`)

    console.log(`INFO [${funcName}]: END - Successfully extracted page ${pageNumber}`)
    return singlePageBase64
  } catch (error) {
    console.error(`ERROR [${funcName}]: Failed to extract page ${pageNumber}`)
    console.error(`ERROR [${funcName}]: Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`ERROR [${funcName}]: Error message: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`ERROR [${funcName}]: Stack trace:`, error instanceof Error ? error.stack : 'No stack trace available')
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
  const requestId = generateRequestId()
  const requestStartTime = Date.now()

  console.log('===============================================')
  console.log(`INFO [MAIN]: REQUEST START - ID: ${requestId}`)
  console.log(`INFO [MAIN]: Timestamp: ${new Date().toISOString()}`)
  console.log(`INFO [MAIN]: Method: ${req.method}`)
  console.log(`INFO [MAIN]: URL: ${req.url}`)
  console.log('===============================================')

  if (req.method === "OPTIONS") {
    console.log(`INFO [MAIN]: OPTIONS request, returning CORS headers - ${requestId}`)
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    console.log(`TRACE [MAIN]: Reading request body - ${requestId}`)
    let requestText: string;
    try {
      const readStartTime = Date.now()
      requestText = await req.text();
      console.log(`TRACE [MAIN]: Request body read in ${Date.now() - readStartTime}ms, size: ${requestText.length} chars - ${requestId}`)
    } catch (readError) {
      console.error(`ERROR [MAIN]: Failed to read request body - ${requestId}`)
      console.error(`ERROR [MAIN]: Error type: ${readError instanceof Error ? readError.constructor.name : typeof readError}`)
      console.error(`ERROR [MAIN]: Error message: ${readError instanceof Error ? readError.message : String(readError)}`)
      console.error(`ERROR [MAIN]: Stack trace:`, readError instanceof Error ? readError.stack : 'No stack trace available')
      return new Response(
        JSON.stringify({
          error: "Failed to read request body",
          details: readError instanceof Error ? readError.message : "Unknown error",
          requestId
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`INFO [MAIN]: Request body size: ${requestText.length} characters - ${requestId}`)
    console.log(`TRACE [MAIN]: Request body preview (first 200 chars): ${requestText.substring(0, 200)} - ${requestId}`)
    console.log(`TRACE [MAIN]: Request body preview (last 200 chars): ${requestText.substring(Math.max(0, requestText.length - 200))} - ${requestId}`)

    console.log(`TRACE [MAIN]: Parsing request JSON - ${requestId}`)
    let requestData: TransformationRequest;
    try {
      const parseStartTime = Date.now()
      requestData = JSON.parse(requestText);
      console.log(`TRACE [MAIN]: JSON parsed successfully in ${Date.now() - parseStartTime}ms - ${requestId}`)
      console.log(`TRACE [MAIN]: Request data keys: ${Object.keys(requestData).join(', ')} - ${requestId}`)
    } catch (parseError) {
      console.error(`ERROR [MAIN]: Failed to parse request JSON - ${requestId}`)
      console.error(`ERROR [MAIN]: Parse error type: ${parseError instanceof Error ? parseError.constructor.name : typeof parseError}`)
      console.error(`ERROR [MAIN]: Parse error message: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      console.error(`ERROR [MAIN]: Invalid JSON content (first 500 chars): ${requestText.substring(0, 500)}`)
      return new Response(
        JSON.stringify({
          error: "Invalid JSON in request body",
          details: parseError instanceof Error ? parseError.message : "Unknown parse error",
          requestId
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { pdfBase64, transformationType, additionalInstructions, apiKey } = requestData;

    console.log(`INFO [MAIN]: PDF base64 length: ${pdfBase64?.length || 0} chars - ${requestId}`)
    console.log(`INFO [MAIN]: Transformation type: ${transformationType?.name} (ID: ${transformationType?.id}) - ${requestId}`)
    console.log(`INFO [MAIN]: Filename template: ${transformationType?.filenameTemplate} - ${requestId}`)
    console.log(`INFO [MAIN]: Field mappings count: ${transformationType?.fieldMappings?.length || 0} - ${requestId}`)
    console.log(`INFO [MAIN]: Additional instructions length: ${additionalInstructions?.length || 0} chars - ${requestId}`)
    console.log(`INFO [MAIN]: API key present: ${!!apiKey} - ${requestId}`);

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

    console.log('===============================================')
    console.log(`INFO [VALIDATION]: FINAL EXTRACTED DATA VALIDATION - ${requestId}`)
    console.log('===============================================')
    console.log(`TRACE [VALIDATION]: Extracted data keys: ${Object.keys(extractedData).join(', ')} - ${requestId}`)
    console.log(`TRACE [VALIDATION]: Extracted data key count: ${Object.keys(extractedData).length} - ${requestId}`)
    console.log(`TRACE [VALIDATION]: Extracted data type: ${typeof extractedData} - ${requestId}`)
    console.log(`TRACE [VALIDATION]: Extracted data is array: ${Array.isArray(extractedData)} - ${requestId}`)

    // Check for circular references
    console.log(`TRACE [VALIDATION]: Checking for circular references - ${requestId}`)
    const hasCircular = hasCircularReference(extractedData)
    console.log(`TRACE [VALIDATION]: Has circular reference: ${hasCircular} - ${requestId}`)
    if (hasCircular) {
      console.error(`ERROR [VALIDATION]: Circular reference detected in extractedData! - ${requestId}`)
    }

    // Log full extracted data structure
    try {
      const dataPreview = JSON.stringify(extractedData, null, 2)
      console.log(`TRACE [VALIDATION]: Full extracted data structure (first 1000 chars): ${dataPreview.substring(0, 1000)} - ${requestId}`)
    } catch (previewError) {
      console.error(`ERROR [VALIDATION]: Cannot preview extracted data: ${previewError} - ${requestId}`)
    }

    // Validate that the final extracted data can be serialized to JSON
    let finalJsonString: string
    try {
      console.log(`TRACE [VALIDATION]: Attempting JSON.stringify on extractedData - ${requestId}`)
      const serializeStartTime = Date.now()
      finalJsonString = JSON.stringify(extractedData)
      console.log(`INFO [VALIDATION]: JSON serialization successful in ${Date.now() - serializeStartTime}ms - ${requestId}`)
      console.log(`INFO [VALIDATION]: Serialized JSON length: ${finalJsonString.length} chars - ${requestId}`)
      console.log(`TRACE [VALIDATION]: Serialized JSON preview (first 200 chars): ${finalJsonString.substring(0, 200)} - ${requestId}`)
      console.log(`TRACE [VALIDATION]: Serialized JSON preview (last 200 chars): ${finalJsonString.substring(Math.max(0, finalJsonString.length - 200))} - ${requestId}`)
    } catch (serializeError) {
      console.error(`ERROR [VALIDATION]: CRITICAL - Cannot serialize extracted data to JSON - ${requestId}`)
      console.error(`ERROR [VALIDATION]: Serialize error type: ${serializeError instanceof Error ? serializeError.constructor.name : typeof serializeError}`)
      console.error(`ERROR [VALIDATION]: Serialize error message: ${serializeError instanceof Error ? serializeError.message : String(serializeError)}`)
      console.error(`ERROR [VALIDATION]: Stack trace:`, serializeError instanceof Error ? serializeError.stack : 'No stack trace available')

      // Create an even simpler fallback
      console.log(`TRACE [VALIDATION]: Creating minimal fallback structure - ${requestId}`)
      extractedData = {
        error: 'Serialization failed',
        message: serializeError instanceof Error ? serializeError.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
      finalJsonString = JSON.stringify(extractedData)
      console.log(`INFO [VALIDATION]: Fallback JSON created, length: ${finalJsonString.length} - ${requestId}`)
    }
    
    // Generate new filename using the template
    console.log('===============================================')
    console.log(`INFO [FILENAME]: FILENAME GENERATION - ${requestId}`)
    console.log('===============================================')
    let newFilename = transformationType.filenameTemplate
    console.log(`TRACE [FILENAME]: Original filename template: ${newFilename} - ${requestId}`)
    console.log(`TRACE [FILENAME]: Number of placeholders to replace: ${Object.keys(extractedData).length} - ${requestId}`)

    // Replace placeholders in filename template with extracted data
    for (const [key, value] of Object.entries(extractedData)) {
      const placeholder = `{{${key}}}`
      if (newFilename.includes(placeholder)) {
        const cleanValue = String(value || '').replace(/[<>:"/\\|?*]/g, '_').trim()
        console.log(`TRACE [FILENAME]: Replacing ${placeholder} with "${cleanValue}" - ${requestId}`);
        newFilename = newFilename.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), cleanValue)
      } else {
        console.log(`TRACE [FILENAME]: Placeholder {{${key}}} not found in template - ${requestId}`)
      }
    }

    // Ensure the filename ends with .pdf
    if (!newFilename.toLowerCase().endsWith('.pdf')) {
      console.log(`TRACE [FILENAME]: Adding .pdf extension - ${requestId}`)
      newFilename += '.pdf'
    }

    // Remove any remaining unreplaced placeholders
    const remainingPlaceholders = newFilename.match(/\{\{[^}]+\}\}/g)
    if (remainingPlaceholders) {
      console.log(`WARNING [FILENAME]: Found ${remainingPlaceholders.length} unreplaced placeholders: ${remainingPlaceholders.join(', ')} - ${requestId}`)
    }
    newFilename = newFilename.replace(/\{\{[^}]+\}\}/g, 'MISSING')

    console.log(`INFO [FILENAME]: Final generated filename: ${newFilename} - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [RESPONSE]: BUILDING RESPONSE - ${requestId}`)
    console.log('===============================================')
    console.log(`TRACE [RESPONSE]: Extracted data size: ${JSON.stringify(extractedData).length} characters - ${requestId}`)
    console.log(`TRACE [RESPONSE]: Building response object - ${requestId}`)

    const responseData = {
        success: true,
        extractedData: extractedData,
        newFilename: newFilename,
        message: 'PDF transformation completed successfully',
        requestId: requestId
    };

    console.log(`TRACE [RESPONSE]: Response object created - ${requestId}`)
    console.log(`TRACE [RESPONSE]: Response object keys: ${Object.keys(responseData).join(', ')} - ${requestId}`)
    console.log(`TRACE [RESPONSE]: Checking response for circular references - ${requestId}`)
    const responseHasCircular = hasCircularReference(responseData)
    console.log(`TRACE [RESPONSE]: Response has circular reference: ${responseHasCircular} - ${requestId}`)

    // Validate response can be serialized
    let responseJson: string;
    try {
      console.log(`TRACE [RESPONSE]: Attempting to serialize response to JSON - ${requestId}`)
      const responseSerializeStartTime = Date.now()
      responseJson = JSON.stringify(responseData);
      console.log(`INFO [RESPONSE]: Response JSON serialization successful in ${Date.now() - responseSerializeStartTime}ms - ${requestId}`)
      console.log(`INFO [RESPONSE]: Response JSON length: ${responseJson.length} chars - ${requestId}`)
      console.log(`TRACE [RESPONSE]: Response JSON preview (first 300 chars): ${responseJson.substring(0, 300)} - ${requestId}`)
    } catch (serializeError) {
      console.error(`ERROR [RESPONSE]: CRITICAL - Cannot serialize response to JSON - ${requestId}`)
      console.error(`ERROR [RESPONSE]: Serialize error type: ${serializeError instanceof Error ? serializeError.constructor.name : typeof serializeError}`)
      console.error(`ERROR [RESPONSE]: Serialize error message: ${serializeError instanceof Error ? serializeError.message : String(serializeError)}`)
      console.error(`ERROR [RESPONSE]: Stack trace:`, serializeError instanceof Error ? serializeError.stack : 'No stack trace available')
      return new Response(
        JSON.stringify({
          error: "Response serialization failed",
          details: serializeError instanceof Error ? serializeError.message : "Unknown serialization error",
          requestId
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const totalTime = Date.now() - requestStartTime
    console.log('===============================================')
    console.log(`INFO [MAIN]: REQUEST SUCCESS - ${requestId}`)
    console.log(`INFO [MAIN]: Total processing time: ${totalTime}ms`)
    console.log(`INFO [MAIN]: Sending response with status 200`)
    console.log('===============================================')

    return new Response(
      responseJson,
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    const totalTime = Date.now() - requestStartTime
    console.log('===============================================')
    console.error(`ERROR [MAIN]: REQUEST FAILED - ${requestId}`)
    console.error(`ERROR [MAIN]: Total time before failure: ${totalTime}ms`)
    console.log('===============================================')

    console.error(`ERROR [MAIN]: Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`ERROR [MAIN]: Error message: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`ERROR [MAIN]: Stack trace:`, error instanceof Error ? error.stack : 'No stack trace available')

    // Provide more detailed error information
    let errorDetails = "Unknown error";
    if (error instanceof Error) {
      errorDetails = error.message;

      // Check for specific error types and provide better messages
      if (error.message.includes("Unexpected end of JSON input")) {
        console.error(`ERROR [MAIN]: Detected JSON parsing error - AI returned incomplete JSON`)
        errorDetails = "The AI returned invalid or incomplete JSON data. This usually happens when the PDF content is unclear or the extraction instructions need to be more specific. Please try with a clearer PDF or adjust your transformation instructions.";
      } else if (error.message.includes("JSON.parse")) {
        console.error(`ERROR [MAIN]: Detected JSON parsing error - Invalid JSON format`)
        errorDetails = "The AI returned data that couldn't be processed as valid JSON. Please check your transformation instructions and try again with a clearer PDF document.";
      } else if (error.message.includes("API key")) {
        console.error(`ERROR [MAIN]: Detected API key error`)
        errorDetails = "Google Gemini API key is missing or invalid. Please check your API configuration in Settings.";
      } else if (error.message.includes("quota") || error.message.includes("rate limit")) {
        console.error(`ERROR [MAIN]: Detected rate limit error`)
        errorDetails = "API rate limit exceeded. Please wait a moment and try again.";
      } else if (error.message.includes("overloaded") || error.message.includes("503")) {
        console.error(`ERROR [MAIN]: Detected service overload error`)
        errorDetails = "The AI service is temporarily overloaded. Please wait a moment and try again.";
      } else if (error.message.includes("Maximum call stack")) {
        console.error(`ERROR [MAIN]: CRITICAL - Maximum call stack size exceeded!`)
        errorDetails = "Maximum call stack size exceeded. This indicates a recursive operation or circular reference in the data structure.";
      }
    }

    const errorResponse = {
      error: "PDF transformation failed",
      details: errorDetails,
      requestId: requestId,
      timestamp: new Date().toISOString()
    };

    console.log(`TRACE [MAIN]: Building error response - ${requestId}`)
    let errorResponseJson: string
    try {
      errorResponseJson = JSON.stringify(errorResponse)
      console.log(`TRACE [MAIN]: Error response JSON created, length: ${errorResponseJson.length} - ${requestId}`)
    } catch (jsonError) {
      console.error(`ERROR [MAIN]: CRITICAL - Cannot even serialize error response! - ${requestId}`)
      console.error(`ERROR [MAIN]: JSON error:`, jsonError)
      errorResponseJson = JSON.stringify({
        error: "Critical error - cannot serialize error response",
        requestId: requestId
      })
    }

    console.log('===============================================')
    console.log(`INFO [MAIN]: Sending error response with status 500 - ${requestId}`)
    console.log('===============================================')

    return new Response(
      errorResponseJson,
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})