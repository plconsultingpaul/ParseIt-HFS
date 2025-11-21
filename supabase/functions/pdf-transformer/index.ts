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
  pageGroupConfig?: {
    enabled: boolean
    numberOfPages: number
    processedPageNumbers?: number[]
  }
}

function normalizeBooleanValue(value: any): string {
  console.log(`TRACE [normalizeBooleanValue]: Input value: ${JSON.stringify(value)}, type: ${typeof value}`)

  if (typeof value === 'boolean') {
    const result = value ? 'True' : 'False'
    console.log(`TRACE [normalizeBooleanValue]: Boolean conversion result: ${result}`)
    return result
  }

  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase().trim()
    console.log(`TRACE [normalizeBooleanValue]: String value (lowercased): ${lowerValue}`)

    if (lowerValue === 'true' || lowerValue === 't' || lowerValue === 'yes' || lowerValue === 'y' || lowerValue === '1') {
      console.log(`TRACE [normalizeBooleanValue]: String matched TRUE pattern`)
      return 'True'
    }
    if (lowerValue === 'false' || lowerValue === 'f' || lowerValue === 'no' || lowerValue === 'n' || lowerValue === '0') {
      console.log(`TRACE [normalizeBooleanValue]: String matched FALSE pattern`)
      return 'False'
    }

    if (value === 'True' || value === 'False') {
      console.log(`TRACE [normalizeBooleanValue]: Already in proper case: ${value}`)
      return value
    }
  }

  console.warn(`⚠️ WARNING [normalizeBooleanValue]: Invalid boolean value "${value}", defaulting to False`)
  return 'False'
}

serve(async (req) => {
  const requestId = crypto.randomUUID()
  console.log('===============================================')
  console.log(`INFO [MAIN]: NEW REQUEST STARTED - ${requestId}`)
  console.log('===============================================')
  console.log(`INFO [MAIN]: Method: ${req.method}`)
  console.log(`INFO [MAIN]: URL: ${req.url}`)

  if (req.method === 'OPTIONS') {
    console.log(`INFO [MAIN]: Handling OPTIONS preflight - ${requestId}`)
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    console.log('===============================================')
    console.log(`INFO [REQUEST]: PARSING REQUEST BODY - ${requestId}`)
    console.log('===============================================')

    const requestData: TransformationRequest = await req.json()

    console.log(`TRACE [REQUEST]: Request keys: ${Object.keys(requestData).join(', ')} - ${requestId}`)
    console.log(`INFO [REQUEST]: Transformation type: ${requestData.transformationType?.name || 'Not provided'} - ${requestId}`)
    console.log(`INFO [REQUEST]: Transformation ID: ${requestData.transformationType?.id || 'Not provided'} - ${requestId}`)
    console.log(`INFO [REQUEST]: API key present: ${!!requestData.apiKey} - ${requestId}`)
    console.log(`INFO [REQUEST]: PDF data present: ${!!requestData.pdfBase64} - ${requestId}`)
    console.log(`INFO [REQUEST]: Field mappings count: ${requestData.transformationType?.fieldMappings?.length || 0} - ${requestId}`)

    if (requestData.pageGroupConfig?.enabled) {
      console.log(`INFO [REQUEST]: Page group processing enabled - ${requestId}`)
      console.log(`INFO [REQUEST]: Number of pages: ${requestData.pageGroupConfig.numberOfPages} - ${requestId}`)
      console.log(`INFO [REQUEST]: Processed page numbers: ${requestData.pageGroupConfig.processedPageNumbers?.join(', ') || 'none'} - ${requestId}`)
    }

    console.log('===============================================')
    console.log(`INFO [VALIDATION]: VALIDATING REQUEST DATA - ${requestId}`)
    console.log('===============================================')

    const { pdfBase64, transformationType, additionalInstructions, apiKey, pageGroupConfig } = requestData

    if (!pdfBase64 || !transformationType || !apiKey) {
      console.error(`ERROR [VALIDATION]: Missing required fields - ${requestId}`)
      console.error(`  - pdfBase64 present: ${!!pdfBase64}`)
      console.error(`  - transformationType present: ${!!transformationType}`)
      console.error(`  - apiKey present: ${!!apiKey}`)
      throw new Error('Missing required fields: pdfBase64, transformationType, and apiKey are required')
    }

    console.log(`INFO [VALIDATION]: All required fields present - ${requestId}`)

    const fieldMappings = transformationType.fieldMappings || []
    console.log(`TRACE [VALIDATION]: Processing ${fieldMappings.length} field mappings - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [PDF]: DECODING PDF - ${requestId}`)
    console.log('===============================================')

    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))
    console.log(`INFO [PDF]: PDF decoded, size: ${pdfBytes.length} bytes - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [PDF]: LOADING PDF DOCUMENT - ${requestId}`)
    console.log('===============================================')

    const pdfDoc = await PDFDocument.load(pdfBytes)
    const totalPages = pdfDoc.getPageCount()
    console.log(`INFO [PDF]: PDF loaded successfully - ${requestId}`)
    console.log(`INFO [PDF]: Total pages: ${totalPages} - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [GEMINI]: INITIALIZING AI CLIENT - ${requestId}`)
    console.log('===============================================')

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    console.log(`INFO [GEMINI]: AI client initialized - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [FIELDS]: ANALYZING FIELD MAPPINGS - ${requestId}`)
    console.log('===============================================')

    const aiFields = fieldMappings.filter(m => m.type === 'ai')
    const mappedFields = fieldMappings.filter(m => m.type === 'mapped')
    const hardcodedFields = fieldMappings.filter(m => m.type === 'hardcoded')

    console.log(`INFO [FIELDS]: AI fields: ${aiFields.length} - ${requestId}`)
    console.log(`INFO [FIELDS]: Mapped fields: ${mappedFields.length} - ${requestId}`)
    console.log(`INFO [FIELDS]: Hardcoded fields: ${hardcodedFields.length} - ${requestId}`)

    if (aiFields.length > 0) {
      console.log(`TRACE [FIELDS]: AI field names: ${aiFields.map(f => f.fieldName).join(', ')} - ${requestId}`)
    }

    console.log('===============================================')
    console.log(`INFO [PROCESSING]: STARTING DATA EXTRACTION - ${requestId}`)
    console.log('===============================================')

    const extractedData: Record<string, any> = {}

    console.log('===============================================')
    console.log(`INFO [HARDCODED]: PROCESSING HARDCODED FIELDS - ${requestId}`)
    console.log('===============================================')

    hardcodedFields.forEach(mapping => {
      console.log(`TRACE [HARDCODED]: Setting ${mapping.fieldName} = "${mapping.value}" - ${requestId}`)
      extractedData[mapping.fieldName] = mapping.value
    })

    console.log(`INFO [HARDCODED]: Processed ${hardcodedFields.length} hardcoded fields - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [MAPPED]: PROCESSING MAPPED FIELDS - ${requestId}`)
    console.log('===============================================')

    mappedFields.forEach(mapping => {
      console.log(`TRACE [MAPPED]: Setting ${mapping.fieldName} = "${mapping.value}" - ${requestId}`)

      if (mapping.dataType === 'boolean') {
        extractedData[mapping.fieldName] = normalizeBooleanValue(mapping.value)
      } else {
        extractedData[mapping.fieldName] = mapping.value
      }
    })

    console.log(`INFO [MAPPED]: Processed ${mappedFields.length} mapped fields - ${requestId}`)

    if (aiFields.length > 0) {
      console.log('===============================================')
      console.log(`INFO [PAGE_GROUP]: DETERMINING PROCESSING MODE - ${requestId}`)
      console.log('===============================================')

      const isPageGroupProcessing = pageGroupConfig?.enabled && pageGroupConfig.numberOfPages > 1

      if (isPageGroupProcessing) {
        console.log(`INFO [PAGE_GROUP]: Multi-page processing enabled - ${requestId}`)
        console.log(`INFO [PAGE_GROUP]: Number of pages in group: ${pageGroupConfig.numberOfPages} - ${requestId}`)

        const processedPageNumbers = pageGroupConfig.processedPageNumbers || []
        console.log(`INFO [PAGE_GROUP]: Already processed pages: ${processedPageNumbers.join(', ') || 'none'} - ${requestId}`)

        for (let pageNum = 1; pageNum <= pageGroupConfig.numberOfPages; pageNum++) {
          if (processedPageNumbers.includes(pageNum)) {
            console.log(`INFO [PAGE_GROUP]: Skipping page ${pageNum} (already processed) - ${requestId}`)
            continue
          }

          console.log('===============================================')
          console.log(`INFO [PAGE_${pageNum}]: PROCESSING PAGE ${pageNum} - ${requestId}`)
          console.log('===============================================')

          const pageFields = aiFields.filter(f => !f.pageNumberInGroup || f.pageNumberInGroup === pageNum)
          console.log(`INFO [PAGE_${pageNum}]: Fields to extract: ${pageFields.length} - ${requestId}`)
          console.log(`TRACE [PAGE_${pageNum}]: Field names: ${pageFields.map(f => f.fieldName).join(', ')} - ${requestId}`)

          if (pageFields.length === 0) {
            console.log(`INFO [PAGE_${pageNum}]: No fields to extract, skipping - ${requestId}`)
            continue
          }

          console.log(`INFO [PAGE_${pageNum}]: Extracting page ${pageNum} from PDF - ${requestId}`)
          const singlePageDoc = await PDFDocument.create()
          const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNum - 1])
          singlePageDoc.addPage(copiedPage)
          const singlePageBytes = await singlePageDoc.save()
          const singlePageBase64 = btoa(String.fromCharCode(...singlePageBytes))

          console.log(`INFO [PAGE_${pageNum}]: Page extracted, size: ${singlePageBytes.length} bytes - ${requestId}`)

          console.log('===============================================')
          console.log(`INFO [AI_PAGE_${pageNum}]: BUILDING EXTRACTION PROMPT - ${requestId}`)
          console.log('===============================================')

          const fieldDescriptions = pageFields.map(f => {
            let desc = `- ${f.fieldName}`
            if (f.dataType) desc += ` (${f.dataType})`
            if (f.value) desc += `: ${f.value}`
            return desc
          }).join('\n')

          console.log(`TRACE [AI_PAGE_${pageNum}]: Field descriptions:\n${fieldDescriptions} - ${requestId}`)

          const baseInstructions = transformationType.defaultInstructions || 'Extract the following fields from this document'
          const finalInstructions = additionalInstructions
            ? `${baseInstructions}\n\nAdditional Instructions: ${additionalInstructions}`
            : baseInstructions

          console.log(`TRACE [AI_PAGE_${pageNum}]: Base instructions length: ${baseInstructions.length} chars - ${requestId}`)
          console.log(`TRACE [AI_PAGE_${pageNum}]: Additional instructions: ${additionalInstructions ? 'Yes' : 'No'} - ${requestId}`)

          const prompt = `${finalInstructions}\n\n${fieldDescriptions}\n\nIMPORTANT: Return ONLY a valid JSON object with the extracted data. Use null for missing values. No markdown, no explanations, just the JSON object with "extractedData" as the root key.`

          console.log(`TRACE [AI_PAGE_${pageNum}]: Final prompt length: ${prompt.length} chars - ${requestId}`)

          console.log('===============================================')
          console.log(`INFO [AI_PAGE_${pageNum}]: SENDING REQUEST TO GEMINI - ${requestId}`)
          console.log('===============================================')

          const result = await model.generateContent([
            {
              inlineData: {
                data: singlePageBase64,
                mimeType: "application/pdf"
              }
            },
            prompt
          ])

          console.log(`INFO [AI_PAGE_${pageNum}]: Received response from Gemini - ${requestId}`)

          console.log('===============================================')
          console.log(`INFO [AI_PAGE_${pageNum}]: PARSING GEMINI RESPONSE - ${requestId}`)
          console.log('===============================================')

          let extractedContent = result.response.text()
          console.log(`TRACE [AI_PAGE_${pageNum}]: Raw response length: ${extractedContent.length} chars - ${requestId}`)
          console.log(`TRACE [AI_PAGE_${pageNum}]: Raw response preview: ${extractedContent.substring(0, 100)}... - ${requestId}`)

          extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

          // Parse and merge with existing data
          try {
            const parsedResponse = JSON.parse(extractedContent)
            const pageData = parsedResponse.extractedData || parsedResponse || {}

            // Apply boolean normalization and string uppercase conversion
            pageFields.forEach(field => {
              const parts = field.fieldName.split('.')

              // Check if we're dealing with an array field (e.g., details.fieldName)
              if (parts.length === 2) {
                const [arrayName, propertyName] = parts
                const arrayData = pageData[arrayName]

                if (Array.isArray(arrayData)) {
                  // Process ALL items in the array
                  arrayData.forEach(item => {
                    const currentValue = item[propertyName]
                    console.log(`DEBUG [NORMALIZE]: Field="${field.fieldName}" DataType="${field.dataType}" Property="${propertyName}" Value="${currentValue}" Type="${typeof currentValue}"`)

                    if (field.dataType?.toLowerCase() === 'boolean' && currentValue !== undefined) {
                      item[propertyName] = normalizeBooleanValue(currentValue)
                      console.log(`DEBUG [NORMALIZE]: After normalization: ${propertyName} = "${item[propertyName]}"`)
                    } else if ((field.dataType === 'string' || !field.dataType) && currentValue !== undefined) {
                      if (typeof currentValue === 'string' && currentValue !== '') {
                        item[propertyName] = currentValue.toUpperCase()
                      }
                    }
                  })
                }
              } else {
                // Handle non-array fields
                const currentValue = pageData[field.fieldName]

                if (field.dataType?.toLowerCase() === 'boolean' && currentValue !== undefined) {
                  pageData[field.fieldName] = normalizeBooleanValue(currentValue)
                } else if ((field.dataType === 'string' || !field.dataType) && currentValue !== undefined) {
                  if (typeof currentValue === 'string' && currentValue !== '') {
                    pageData[field.fieldName] = currentValue.toUpperCase()
                  }
                }
              }
            })

            // Merge page-specific data into final result
            Object.assign(extractedData, pageData)
            console.log(`DEBUG [FINAL]: extractedData.details = ${JSON.stringify(extractedData.details)}`)

            console.log(`✅ Page ${pageNum} data extracted successfully:`, Object.keys(pageData).join(', '))
          } catch (parseError) {
            console.error(`❌ Failed to parse Page ${pageNum} response:`, parseError)
            // Set empty values for failed fields
            pageFields.forEach(field => {
              if (!extractedData[field.fieldName]) {
                extractedData[field.fieldName] = null
              }
            })
          }
        }
      } else {
        console.log(`INFO [SINGLE_PAGE]: Processing entire document as single unit - ${requestId}`)
        console.log('===============================================')
        console.log(`INFO [AI]: BUILDING EXTRACTION PROMPT - ${requestId}`)
        console.log('===============================================')

        const fieldDescriptions = aiFields.map(f => {
          let desc = `- ${f.fieldName}`
          if (f.dataType) desc += ` (${f.dataType})`
          if (f.value) desc += `: ${f.value}`
          return desc
        }).join('\n')

        console.log(`TRACE [AI]: Field descriptions:\n${fieldDescriptions} - ${requestId}`)

        const baseInstructions = transformationType.defaultInstructions || 'Extract the following fields from this document'
        const finalInstructions = additionalInstructions
          ? `${baseInstructions}\n\nAdditional Instructions: ${additionalInstructions}`
          : baseInstructions

        console.log(`TRACE [AI]: Base instructions length: ${baseInstructions.length} chars - ${requestId}`)
        console.log(`TRACE [AI]: Additional instructions: ${additionalInstructions ? 'Yes' : 'No'} - ${requestId}`)

        const prompt = `${finalInstructions}\n\n${fieldDescriptions}\n\nIMPORTANT: Return ONLY a valid JSON object with the extracted data. Use null for missing values. No markdown, no explanations, just the JSON object with "extractedData" as the root key.`

        console.log(`TRACE [AI]: Final prompt length: ${prompt.length} chars - ${requestId}`)

        console.log('===============================================')
        console.log(`INFO [AI]: SENDING REQUEST TO GEMINI - ${requestId}`)
        console.log('===============================================')

        const result = await model.generateContent([
          {
            inlineData: {
              data: pdfBase64,
              mimeType: "application/pdf"
            }
          },
          prompt
        ])

        console.log(`INFO [AI]: Received response from Gemini - ${requestId}`)

        console.log('===============================================')
        console.log(`INFO [AI]: PARSING GEMINI RESPONSE - ${requestId}`)
        console.log('===============================================')

        let extractedContent = result.response.text()
        console.log(`TRACE [AI]: Raw response length: ${extractedContent.length} chars - ${requestId}`)
        console.log(`TRACE [AI]: Raw response preview: ${extractedContent.substring(0, 100)}... - ${requestId}`)

        extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

        try {
          const parsedResponse = JSON.parse(extractedContent)
          const responseData = parsedResponse.extractedData || parsedResponse || {}

          console.log(`TRACE [AI]: Parsed response keys: ${Object.keys(responseData).join(', ')} - ${requestId}`)

          // Apply boolean normalization and string uppercase conversion
          aiFields.forEach(field => {
            const parts = field.fieldName.split('.')

            // Check if we're dealing with an array field (e.g., details.fieldName)
            if (parts.length === 2) {
              const [arrayName, propertyName] = parts
              const arrayData = responseData[arrayName]

              if (Array.isArray(arrayData)) {
                // Process ALL items in the array
                arrayData.forEach(item => {
                  const currentValue = item[propertyName]
                  console.log(`DEBUG [NORMALIZE]: Field="${field.fieldName}" DataType="${field.dataType}" Property="${propertyName}" Value="${currentValue}" Type="${typeof currentValue}"`)

                  if (field.dataType?.toLowerCase() === 'boolean' && currentValue !== undefined) {
                    item[propertyName] = normalizeBooleanValue(currentValue)
                    console.log(`DEBUG [NORMALIZE]: After normalization: ${propertyName} = "${item[propertyName]}"`)
                  } else if ((field.dataType === 'string' || !field.dataType) && currentValue !== undefined) {
                    if (typeof currentValue === 'string' && currentValue !== '') {
                      item[propertyName] = currentValue.toUpperCase()
                    }
                  }
                })
              }
            } else {
              // Handle non-array fields
              const currentValue = responseData[field.fieldName]

              if (field.dataType?.toLowerCase() === 'boolean' && currentValue !== undefined) {
                responseData[field.fieldName] = normalizeBooleanValue(currentValue)
              } else if ((field.dataType === 'string' || !field.dataType) && currentValue !== undefined) {
                if (typeof currentValue === 'string' && currentValue !== '') {
                  responseData[field.fieldName] = currentValue.toUpperCase()
                }
              }
            }
          })

          Object.assign(extractedData, responseData)
          console.log(`DEBUG [FINAL]: extractedData.details = ${JSON.stringify(extractedData.details)}`)
          console.log(`INFO [AI]: Extracted data keys: ${Object.keys(responseData).join(', ')} - ${requestId}`)
        } catch (parseError) {
          console.error(`ERROR [AI]: Failed to parse Gemini response - ${requestId}`, parseError)
          console.error(`ERROR [AI]: Raw content: ${extractedContent.substring(0, 500)} - ${requestId}`)
          throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
        }
      }
    }

    console.log('===============================================')
    console.log(`INFO [EXTRACTION]: DATA EXTRACTION COMPLETE - ${requestId}`)
    console.log('===============================================')
    console.log(`INFO [EXTRACTION]: Total fields extracted: ${Object.keys(extractedData).length} - ${requestId}`)
    console.log(`TRACE [EXTRACTION]: Extracted field names: ${Object.keys(extractedData).join(', ')} - ${requestId}`)

    console.log('===============================================')
    console.log(`INFO [FILENAME]: GENERATING FILENAME - ${requestId}`)
    console.log('===============================================')

    const filenameTemplate = transformationType.filenameTemplate || 'transformed_document'
    console.log(`TRACE [FILENAME]: Template: ${filenameTemplate} - ${requestId}`)

    let newFilename = filenameTemplate
    const matches = filenameTemplate.matchAll(/\{([^}]+)\}/g)

    console.log(`TRACE [FILENAME]: Starting template substitution - ${requestId}`)

    for (const match of matches) {
      const fieldName = match[1]
      const fieldValue = extractedData[fieldName]

      console.log(`TRACE [FILENAME]: Replacing {${fieldName}} with "${fieldValue}" - ${requestId}`)

      if (fieldValue !== undefined && fieldValue !== null) {
        const sanitizedValue = String(fieldValue)
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')

        console.log(`TRACE [FILENAME]: Sanitized value: "${sanitizedValue}" - ${requestId}`)
        newFilename = newFilename.replace(`{${fieldName}}`, sanitizedValue)
      } else {
        console.warn(`WARNING [FILENAME]: Field {${fieldName}} is missing or null, replacing with 'unknown' - ${requestId}`)
        newFilename = newFilename.replace(`{${fieldName}}`, 'unknown')
      }
    }

    if (!newFilename.toLowerCase().endsWith('.pdf')) {
      console.log(`TRACE [FILENAME]: Adding .pdf extension - ${requestId}`)
      newFilename += '.pdf'
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
