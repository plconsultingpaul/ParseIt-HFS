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

// Helper function to check if a buffer is a valid PDF
function isValidPdf(buffer: Uint8Array): boolean {
  try {
    // Check for PDF header (%PDF-)
    const header = new TextDecoder().decode(buffer.slice(0, 5))
    return header === '%PDF-'
  } catch {
    return false
  }
}

// Helper function to safely decode base64 in chunks to avoid stack overflow
function safeBase64Decode(base64String: string): Uint8Array {
  try {
    console.log(`TRACE [safeBase64Decode]: Starting base64 decode, input length: ${base64String.length}`)
    
    // Remove any whitespace or newlines
    const cleanBase64 = base64String.replace(/\s/g, '')
    console.log(`TRACE [safeBase64Decode]: Cleaned base64 length: ${cleanBase64.length}`)
    
    // Decode in chunks to avoid stack overflow
    const chunks: Uint8Array[] = []
    let offset = 0
    
    while (offset < cleanBase64.length) {
      const chunk = cleanBase64.slice(offset, offset + CHUNK_SIZE)
      const binaryString = atob(chunk)
      const bytes = new Uint8Array(binaryString.length)
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      
      chunks.push(bytes)
      offset += CHUNK_SIZE
      
      if (offset % (CHUNK_SIZE * 10) === 0) {
        console.log(`TRACE [safeBase64Decode]: Processed ${offset}/${cleanBase64.length} characters (${Math.round(offset / cleanBase64.length * 100)}%)`)
      }
    }
    
    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let position = 0
    
    for (const chunk of chunks) {
      result.set(chunk, position)
      position += chunk.length
    }
    
    console.log(`TRACE [safeBase64Decode]: Decode complete, output length: ${result.length} bytes`)
    
    // Validate the decoded PDF
    if (!isValidPdf(result)) {
      throw new Error('Decoded data is not a valid PDF')
    }
    
    return result
  } catch (error) {
    console.error('ERROR [safeBase64Decode]: Failed to decode base64:', error)
    throw error
  }
}

// Function to group field mappings by page number
function groupFieldsByPage(fieldMappings: FieldMapping[]): Map<number, FieldMapping[]> {
  const pageGroups = new Map<number, FieldMapping[]>()
  
  for (const field of fieldMappings) {
    const pageNum = field.pageNumberInGroup || 1
    
    if (!pageGroups.has(pageNum)) {
      pageGroups.set(pageNum, [])
    }
    
    pageGroups.get(pageNum)!.push(field)
  }
  
  console.log(`📊 Field mappings grouped by page:`)
  for (const [pageNum, fields] of pageGroups.entries()) {
    console.log(`   Page ${pageNum}: ${fields.length} fields - ${fields.map(f => f.fieldName).join(', ')}`)
  }
  
  return pageGroups
}

// Function to extract a specific page from a PDF
async function extractSpecificPage(pdfBase64: string, pageNumber: number): Promise<string> {
  try {
    console.log(`📄 Extracting page ${pageNumber} from PDF...`)
    
    // Decode the PDF
    const pdfBytes = safeBase64Decode(pdfBase64)
    
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const totalPages = pdfDoc.getPageCount()
    
    console.log(`   Total pages in PDF: ${totalPages}`)
    
    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new Error(`Invalid page number ${pageNumber}. PDF has ${totalPages} pages.`)
    }
    
    // Create a new PDF with just the specific page
    const newPdf = await PDFDocument.create()
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1])
    newPdf.addPage(copiedPage)
    
    // Save and encode
    const newPdfBytes = await newPdf.save()
    const newPdfBase64 = btoa(String.fromCharCode(...newPdfBytes))
    
    console.log(`✅ Extracted page ${pageNumber} (${newPdfBytes.length} bytes)`)
    
    return newPdfBase64
  } catch (error) {
    console.error(`❌ Failed to extract page ${pageNumber}:`, error)
    throw error
  }
}

serve(async (req: Request) => {
  const requestId = generateRequestId()
  console.log('===============================================')
  console.log(`INFO [MAIN]: NEW TRANSFORMATION REQUEST - ${requestId}`)
  console.log('===============================================')
  console.log(`TRACE [MAIN]: Request method: ${req.method} - ${requestId}`)
  console.log(`TRACE [MAIN]: Request URL: ${req.url} - ${requestId}`)
  
  if (req.method === 'OPTIONS') {
    console.log(`INFO [MAIN]: Handling OPTIONS preflight request - ${requestId}`)
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    console.log(`TRACE [MAIN]: Reading request body - ${requestId}`)
    const bodyStartTime = Date.now()
    let requestText: string
    
    try {
      requestText = await req.text()
      console.log(`TRACE [MAIN]: Request body read successfully in ${Date.now() - bodyStartTime}ms - ${requestId}`)
      console.log(`TRACE [MAIN]: Request body length: ${requestText.length} characters - ${requestId}`)
    } catch (readError) {
      console.error(`ERROR [MAIN]: Failed to read request body - ${requestId}`)
      console.error(`ERROR [MAIN]: Read error type: ${readError instanceof Error ? readError.constructor.name : typeof readError}`)
      console.error(`ERROR [MAIN]: Read error message: ${readError instanceof Error ? readError.message : String(readError)}`)
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

    console.log('===============================================')
    console.log(`INFO [MAIN]: PARSING REQUEST DATA - ${requestId}`)
    console.log('===============================================')
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

    console.log(`TRACE [MAIN]: Transformation type: ${requestData.transformationType?.name || 'unknown'} - ${requestId}`)
    console.log(`TRACE [MAIN]: Transformation type ID: ${requestData.transformationType?.id || 'unknown'} - ${requestId}`)
    console.log(`TRACE [MAIN]: Has field mappings: ${!!requestData.transformationType?.fieldMappings} - ${requestId}`)
    console.log(`TRACE [MAIN]: Field mappings count: ${requestData.transformationType?.fieldMappings?.length || 0} - ${requestId}`)
    console.log(`TRACE [MAIN]: Has API key: ${!!requestData.apiKey} - ${requestId}`)
    console.log(`TRACE [MAIN]: Has PDF data: ${!!requestData.pdfBase64} - ${requestId}`)
    console.log(`TRACE [MAIN]: PDF data length: ${requestData.pdfBase64?.length || 0} characters - ${requestId}`)

    const { pdfBase64, transformationType, additionalInstructions, apiKey } = requestData;

    console.log('===============================================')
    console.log(`INFO [MAIN]: VALIDATING REQUEST DATA - ${requestId}`)
    console.log('===============================================')

    if (!pdfBase64) {
      console.error(`ERROR [MAIN]: Missing PDF data - ${requestId}`)
      return new Response(
        JSON.stringify({ error: 'PDF data is required', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!transformationType) {
      console.error(`ERROR [MAIN]: Missing transformation type - ${requestId}`)
      return new Response(
        JSON.stringify({ error: 'Transformation type is required', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!apiKey) {
      console.error(`ERROR [MAIN]: Missing API key - ${requestId}`)
      return new Response(
        JSON.stringify({ error: 'API key is required', requestId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`INFO [MAIN]: All required data present - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [AI]: INITIALIZING GEMINI AI - ${requestId}`)
    console.log('===============================================')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    console.log(`INFO [AI]: Gemini AI initialized successfully - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [EXTRACTION]: BEGINNING DATA EXTRACTION - ${requestId}`)
    console.log('===============================================')

    let extractedData: any = {}

    // Check if we have field mappings for targeted extraction
    if (transformationType.fieldMappings && transformationType.fieldMappings.length > 0) {
      console.log('✨ Using field-by-field extraction mode')
      console.log(`   Total fields to extract: ${transformationType.fieldMappings.length}`)

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
              // Helper to get nested value by path
              const getValueByPath = (obj: any, path: string): any => {
                return path.split('.').reduce((current, prop) => current?.[prop], obj)
              }

              // Helper to set nested value by path
              const setValueByPath = (obj: any, path: string, value: any): void => {
                const parts = path.split('.')
                const last = parts.pop()!
                const target = parts.reduce((current, prop) => {
                  if (!current[prop]) current[prop] = {}
                  return current[prop]
                }, obj)
                target[last] = value
              }

              const currentValue = getValueByPath(pageData, field.fieldName)

              if (field.dataType === 'boolean' && currentValue !== undefined) {
                setValueByPath(pageData, field.fieldName, normalizeBooleanValue(currentValue))
              } else if ((field.dataType === 'string' || !field.dataType) && currentValue !== undefined) {
                // Convert string fields to uppercase
                if (typeof currentValue === 'string' && currentValue !== '') {
                  setValueByPath(pageData, field.fieldName, currentValue.toUpperCase())
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

    console.log(`INFO [FILENAME]: Generated filename: ${newFilename} - ${requestId}`)
    console.log(`TRACE [FILENAME]: Filename length: ${newFilename.length} characters - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [RESPONSE]: PREPARING RESPONSE - ${requestId}`)
    console.log('===============================================')
    
    const responseData = {
      success: true,
      newFilename,
      extractedData,
      requestId
    }
    
    console.log(`TRACE [RESPONSE]: Response data keys: ${Object.keys(responseData).join(', ')} - ${requestId}`)
    console.log(`TRACE [RESPONSE]: Response data size: ${JSON.stringify(responseData).length} bytes - ${requestId}`)
    console.log(`INFO [RESPONSE]: Sending successful response - ${requestId}`)
    console.log('===============================================')
    console.log(`INFO [MAIN]: REQUEST COMPLETED SUCCESSFULLY - ${requestId}`)
    console.log('===============================================')

    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.log('===============================================')
    console.error(`ERROR [MAIN]: CRITICAL ERROR OCCURRED - ${requestId}`)
    console.log('===============================================')
    console.error(`ERROR [MAIN]: Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`ERROR [MAIN]: Error message: ${error instanceof Error ? error.message : String(error)}`)
    console.error(`ERROR [MAIN]: Stack trace:`, error instanceof Error ? error.stack : 'No stack trace available')
    console.log('===============================================')

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        requestId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

const fullInstructions = `${transformationType.defaultInstructions || ''}${additionalInstructions ? '\n\nAdditional Instructions:\n' + additionalInstructions : ''}`