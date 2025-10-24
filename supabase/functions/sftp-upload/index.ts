import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Buffer } from "node:buffer"
import { PDFDocument } from "npm:pdf-lib@1.17.1"
import * as xml2js from "xml2js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface UploadRequest {
  sftpConfig: {
    host: string
    port: number
    username: string
    password: string
    xmlPath: string
    pdfPath: string
    jsonPath: string
    csvPath?: string
  }
  xmlContent: string
  pdfBase64: string
  baseFilename: string
  originalFilename?: string
  parseitIdMapping?: string
  useExistingParseitId?: number
  userId?: string
  extractionTypeId?: string
  transformationTypeId?: string
  formatType?: string
  customFilenamePart?: string
  exactFilename?: string
  pdfUploadStrategy?: 'all_pages_in_group' | 'specific_page_in_group'
  specificPageToUpload?: number
  uploadFileTypes?: {
    json?: boolean
    pdf?: boolean
    xml?: boolean
    csv?: boolean
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const { sftpConfig, xmlContent, pdfBase64, baseFilename, originalFilename, parseitIdMapping, useExistingParseitId, userId, extractionTypeId, transformationTypeId, formatType, customFilenamePart, exactFilename, pdfUploadStrategy, specificPageToUpload, uploadFileTypes }: UploadRequest = await req.json()

    console.log('=== SFTP UPLOAD DEBUG ===')
    console.log('Request received with fields:')
    console.log('- sftpConfig present:', !!sftpConfig)
    console.log('- sftpConfig.host:', sftpConfig?.host || 'MISSING')
    console.log('- sftpConfig.username:', sftpConfig?.username ? 'SET' : 'MISSING')
    console.log('- sftpConfig.password:', sftpConfig?.password ? 'SET' : 'MISSING')
    console.log('- sftpConfig.xmlPath:', sftpConfig?.xmlPath || 'MISSING')
    console.log('- sftpConfig.pdfPath:', sftpConfig?.pdfPath || 'MISSING')
    console.log('- sftpConfig.jsonPath:', sftpConfig?.jsonPath || 'MISSING')
    console.log('- xmlContent present:', !!xmlContent)
    console.log('- xmlContent length:', xmlContent?.length || 0)
    console.log('- pdfBase64 present:', !!pdfBase64)
    console.log('- pdfBase64 length:', pdfBase64?.length || 0)
    console.log('- baseFilename:', baseFilename || 'MISSING')
    console.log('- originalFilename:', originalFilename || 'MISSING')
    console.log('- exactFilename:', exactFilename || 'MISSING')
    console.log('- customFilenamePart:', customFilenamePart || 'MISSING')
    console.log('- formatType:', formatType || 'MISSING')
    console.log('- extractionTypeId:', extractionTypeId || 'MISSING')
    console.log('- transformationTypeId:', transformationTypeId || 'MISSING')
    console.log('- pdfUploadStrategy:', pdfUploadStrategy || 'MISSING')
    console.log('- specificPageToUpload:', specificPageToUpload || 'MISSING')
    console.log('- uploadFileTypes:', uploadFileTypes || 'MISSING (will default to all types)')
    
    console.log('SFTP Upload Request received:')
    console.log('- useExistingParseitId:', useExistingParseitId)
    console.log('- parseitIdMapping:', parseitIdMapping)
    console.log('- userId:', userId)
    console.log('- extractionTypeId:', extractionTypeId)
    console.log('- transformationTypeId:', transformationTypeId)
    console.log('- originalFilename:', originalFilename)
    console.log('- customFilenamePart:', customFilenamePart)
    console.log('- exactFilename:', exactFilename)

    // Validate required fields
    if (!sftpConfig.host || !sftpConfig.username || !xmlContent || !pdfBase64 || !baseFilename) {
      console.log('=== VALIDATION FAILED ===')
      console.log('Missing required fields:')
      console.log('- sftpConfig.host:', !sftpConfig.host ? 'MISSING' : 'OK')
      console.log('- sftpConfig.username:', !sftpConfig.username ? 'MISSING' : 'OK')
      console.log('- xmlContent:', !xmlContent ? 'MISSING' : 'OK')
      console.log('- pdfBase64:', !pdfBase64 ? 'MISSING' : 'OK')
      console.log('- baseFilename:', !baseFilename ? 'MISSING' : 'OK')
      
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Import SFTP client using the alias from deno.json
    const Client = (await import("ssh2-sftp-client")).default
    
    const sftp = new Client()

    try {
      // Load and analyze the PDF
      const pdfBuffer = Buffer.from(pdfBase64, 'base64')
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pageCount = pdfDoc.getPageCount()
      
      console.log(`🔧 === SFTP PDF ANALYSIS RESULTS ===`)
      console.log(`🔧 PDF received has ${pageCount} pages`)
      console.log(`🔧 extractionTypeId: ${extractionTypeId || 'NONE'}`)
      console.log(`🔧 transformationTypeId: ${transformationTypeId || 'NONE'}`)
      console.log(`🔧 pdfUploadStrategy: ${pdfUploadStrategy || 'all_pages_in_group (default)'}`)
      console.log(`🔧 specificPageToUpload: ${specificPageToUpload || 'N/A'}`)
      
      // Get Supabase configuration
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase configuration missing')
      }

      // Helper function to log extraction
      const logExtraction = async (
        extractionTypeIdParam: string | null,
        transformationTypeIdParam: string | null,
        pdfFilename: string,
        pdfPages: number,
        status: 'success' | 'failed',
        errorMessage?: string,
        parseitId?: number
      ) => {
        try {
          const logData: any = {
            user_id: userId || null,
            extraction_type_id: extractionTypeIdParam,
            transformation_type_id: transformationTypeIdParam,
            pdf_filename: pdfFilename,
            pdf_pages: pdfPages,
            extraction_status: status,
            error_message: errorMessage || null,
            extracted_data: xmlContent || null,
            processing_mode: transformationTypeIdParam ? 'transformation' : 'extraction',
            created_at: new Date().toISOString()
          }
          
          if (parseitId) {
            logData.parseit_id = parseitId
          }
          
          await fetch(`${supabaseUrl}/rest/v1/extraction_logs`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify(logData)
          })
          
          console.log('Successfully logged extraction:', logData)
        } catch (logError) {
          console.warn('Failed to log extraction:', logError)
          // Don't throw - logging failure shouldn't break the main process
        }
      }

      // Connect to SFTP server
      await sftp.connect({
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password: sftpConfig.password,
      })

      // Ensure directories exist
      await sftp.mkdir(sftpConfig.xmlPath, true)
      await sftp.mkdir(sftpConfig.pdfPath, true)
      await sftp.mkdir(sftpConfig.jsonPath, true)
      if (sftpConfig.csvPath) {
        await sftp.mkdir(sftpConfig.csvPath, true)
      }

      // Set default file type filters (all enabled if not specified)
      const fileTypeFilters = uploadFileTypes || { json: true, pdf: true, xml: true, csv: true }
      console.log('📋 File type filters:', fileTypeFilters)
      console.log('📋 Will upload:')
      console.log('  - JSON files:', fileTypeFilters.json !== false ? 'YES' : 'NO')
      console.log('  - PDF files:', fileTypeFilters.pdf !== false ? 'YES' : 'NO')
      console.log('  - XML files:', fileTypeFilters.xml !== false ? 'YES' : 'NO')
      console.log('  - CSV files:', fileTypeFilters.csv !== false ? 'YES' : 'NO')

      const uploadResults = []

      // === CRITICAL DECISION POINT: TRANSFORMATION VS EXTRACTION LOGIC ===
      if (transformationTypeId) {
        console.log('🔄 === TRANSFORMATION TYPE UPLOAD PATH ===')
        console.log('🔄 This is a transformation type upload - treating PDF as logical document')
        console.log('🔄 PDF pages in logical document:', pageCount)
        console.log('🔄 Upload strategy:', pdfUploadStrategy || 'all_pages_in_group (default)')
        
        // For transformation types, the incoming PDF is already a "logical document"
        // We should upload it as a single unit, not split it into individual pages
        
        // Generate a single ParseIt ID for this logical document
        let parseitId: number
        
        if (useExistingParseitId !== undefined && useExistingParseitId !== null && typeof useExistingParseitId === 'number') {
          parseitId = useExistingParseitId
          console.log('🔄 Using existing ParseIt ID:', parseitId)
        } else {
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_next_parseit_id`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({})
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('Failed to get ParseIt ID:', response.status, errorText)
            throw new Error('Failed to get next ParseIt_ID for logical document')
          }

          parseitId = await response.json()
          console.log('🔄 Generated new ParseIt ID:', parseitId)
        }
        
        // Determine final filename prefix
        let finalFilenamePrefix: string
        
        if (exactFilename) {
          finalFilenamePrefix = exactFilename.replace(/\.pdf$/i, '')
          console.log('🔄 Using exact filename from workflow:', finalFilenamePrefix)
        } else if (customFilenamePart) {
          finalFilenamePrefix = `${baseFilename}${customFilenamePart}`
          console.log('🔄 Using custom filename part:', finalFilenamePrefix)
        } else {
          finalFilenamePrefix = baseFilename.endsWith('_') ? baseFilename.slice(0, -1) : baseFilename
          console.log('🔄 Using base filename:', finalFilenamePrefix)
        }
        
        // Handle data file (JSON/XML/CSV) upload - single file for the logical document
        let dataFilename: string
        let dataContent: string
        let dataPath: string

        if (formatType === 'JSON') {
          try {
            let jsonObject = JSON.parse(xmlContent)

            // Inject ParseIt ID if mapping is provided
            if (parseitIdMapping) {
              jsonObject = injectParseitId(jsonObject, parseitIdMapping, parseitId)
            }

            dataContent = JSON.stringify(jsonObject, null, 2)
            dataFilename = `${finalFilenamePrefix}.json`
            dataPath = `${sftpConfig.jsonPath}/${dataFilename}`
          } catch (error) {
            throw new Error(`Failed to process JSON content: ${error.message}`)
          }
        } else if (formatType === 'CSV') {
          dataContent = xmlContent
          dataFilename = `${finalFilenamePrefix}.csv`
          if (!sftpConfig.csvPath) {
            throw new Error('CSV Path is not configured in SFTP settings. Please configure CSV Path before uploading CSV files.')
          }
          dataPath = `${sftpConfig.csvPath}/${dataFilename}`
          console.log('🔄 Using CSV format, uploading to:', dataPath)
        } else {
          dataContent = xmlContent
          dataContent = dataContent.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, parseitId.toString())
          dataFilename = `${finalFilenamePrefix}.xml`
          dataPath = `${sftpConfig.xmlPath}/${dataFilename}`
        }
        
        // Upload data file based on file type filters
        let shouldUploadDataFile = true
        if (formatType === 'JSON' && fileTypeFilters.json === false) {
          shouldUploadDataFile = false
          console.log(`🔄 ⏭️  Skipping JSON file upload (disabled in filters): ${dataPath}`)
        } else if (formatType === 'CSV' && fileTypeFilters.csv === false) {
          shouldUploadDataFile = false
          console.log(`🔄 ⏭️  Skipping CSV file upload (disabled in filters): ${dataPath}`)
        } else if (formatType === 'XML' && fileTypeFilters.xml === false) {
          shouldUploadDataFile = false
          console.log(`🔄 ⏭️  Skipping XML file upload (disabled in filters): ${dataPath}`)
        } else if (transformationTypeId && formatType === 'JSON') {
          shouldUploadDataFile = false
          console.log(`🔄 ⏭️  Skipping JSON data file upload for transformation context: ${dataPath}`)
        }

        if (shouldUploadDataFile) {
          console.log(`🔄 Uploading data file: ${dataPath}`)
          await sftp.put(Buffer.from(dataContent, 'utf8'), dataPath)
        }

        // Determine PDF content to upload based on strategy
        let pdfToUploadDoc: PDFDocument
        let actualPdfPageCount: number
        
        if (pdfUploadStrategy === 'specific_page_in_group' && specificPageToUpload && specificPageToUpload > 0 && specificPageToUpload <= pageCount) {
          console.log(`🔄 Extracting specific page ${specificPageToUpload} from ${pageCount}-page logical document`)
          
          // Create a new PDF with only the specific page
          pdfToUploadDoc = await PDFDocument.create()
          const [copiedPage] = await pdfToUploadDoc.copyPages(pdfDoc, [specificPageToUpload - 1]) // Convert to 0-based index
          pdfToUploadDoc.addPage(copiedPage)
          actualPdfPageCount = 1
          
          console.log(`🔄 Created single-page PDF for upload (page ${specificPageToUpload})`)
        } else {
          console.log(`🔄 Using entire logical document for upload (${pageCount} pages)`)
          pdfToUploadDoc = pdfDoc
          actualPdfPageCount = pageCount
        }
        
        // Upload the PDF as a single logical document
        const pdfFilename = `${finalFilenamePrefix}.pdf`
        const pdfPath = `${sftpConfig.pdfPath}/${pdfFilename}`

        let pdfUploaded = false
        if (fileTypeFilters.pdf === false) {
          console.log(`🔄 ⏭️  Skipping PDF upload (disabled in filters): ${pdfPath}`)
        } else {
          console.log(`🔄 Uploading logical document PDF: ${pdfPath}`)
          console.log(`🔄 PDF contains ${actualPdfPageCount} page(s)`)

          const pdfBytes = await pdfToUploadDoc.save()
          const pdfBufferForUpload = Buffer.from(pdfBytes)
          await sftp.put(pdfBufferForUpload, pdfPath)
          pdfUploaded = true
        }

        uploadResults.push({
          logicalDocument: 1,
          parseitId: parseitId,
          actualFilename: pdfFilename,
          dataFilename: dataFilename,
          pagesInDocument: actualPdfPageCount,
          files: {
            data: shouldUploadDataFile ? dataPath : null,
            pdf: pdfUploaded ? pdfPath : null
          }
        })

        console.log('🔄 === TRANSFORMATION UPLOAD COMPLETE ===')
        console.log('🔄 Uploaded logical document with:', actualPdfPageCount, 'pages')
        console.log('🔄 Final filename:', pdfFilename)
        
        // Log successful extraction for transformation type
        try {
          await logExtraction(
            null, // No extractionTypeId for transformation
            transformationTypeId,
            originalFilename || (baseFilename + '.pdf') || 'unknown.pdf',
            actualPdfPageCount,
            'success',
            null,
            parseitId
          )
        } catch (logError) {
          console.warn('Failed to log successful transformation:', logError)
        }

      } else {
        console.log('📄 === EXTRACTION TYPE UPLOAD PATH ===')
        console.log('📄 This is an extraction type upload - splitting PDF into individual pages')
        console.log('📄 Total pages to process:', pageCount)
        
        // For extraction types, split the PDF into individual pages (existing logic)
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          console.log(`📄 Processing page ${pageIndex + 1} of ${pageCount}`)
          
          let parseitId: number
          
          // For the first page, use existing ParseIt ID if provided
          if (pageIndex === 0 && useExistingParseitId !== undefined && useExistingParseitId !== null && typeof useExistingParseitId === 'number') {
            parseitId = useExistingParseitId
            console.log(`📄 Page ${pageIndex + 1} - Using existing ParseIt ID from JSON:`, parseitId)
          } else {
            // Get next ParseIt ID for this page
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_next_parseit_id`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({})
            })

            if (!response.ok) {
              const errorText = await response.text()
              console.error('Failed to get ParseIt ID:', response.status, errorText)
              throw new Error(`Failed to get next ParseIt_ID for page ${pageIndex + 1}`)
            }

            parseitId = await response.json()
            console.log(`📄 Page ${pageIndex + 1} - Generated new ParseIt ID:`, parseitId)
            
            if (!parseitId || typeof parseitId !== 'number') {
              console.error('Invalid ParseIt ID received:', parseitId)
              throw new Error(`Invalid ParseIt ID received for page ${pageIndex + 1}`)
            }
          }
          
          // Determine final filename prefix
          let finalFilenamePrefix: string
          
          if (exactFilename) {
            // Use exact filename from workflow (e.g., from rename_pdf step)
            // Remove .pdf extension if present since we'll add it back with page number
            finalFilenamePrefix = exactFilename.replace(/\.pdf$/i, '')
            console.log(`📄 Page ${pageIndex + 1} using exact filename from workflow:`, finalFilenamePrefix)
          } else if (customFilenamePart) {
            // Combine base filename (e.g., "BL_") with custom part (e.g., "12345") = "BL_12345"
            finalFilenamePrefix = `${baseFilename}${customFilenamePart}`
            console.log(`📄 Page ${pageIndex + 1} using custom filename part:`, finalFilenamePrefix)
          } else {
            // If no custom filename part, use base filename and remove trailing underscore if present
            finalFilenamePrefix = baseFilename.endsWith('_') ? baseFilename.slice(0, -1) : baseFilename
            console.log(`📄 Page ${pageIndex + 1} using base filename:`, finalFilenamePrefix)
          }
          
          console.log(`📄 Page ${pageIndex + 1} filename construction:`)
          console.log('- exactFilename:', exactFilename)
          console.log('- baseFilename:', baseFilename)
          console.log('- customFilenamePart:', customFilenamePart)
          console.log('- finalFilenamePrefix:', finalFilenamePrefix)
          
          // Create final filenames: finalFilenamePrefix_pageNumber.extension (unless exactFilename is used for single page)
          let dataFilename: string
          let dataContent: string
          let dataPath: string
          
          // Handle content based on format type
          if (formatType === 'JSON') {
            // Handle JSON format
            try {
              let jsonObject = JSON.parse(xmlContent)

              // Inject ParseIt ID if mapping is provided
              if (parseitIdMapping) {
                jsonObject = injectParseitId(jsonObject, parseitIdMapping, parseitId)
              }

              dataContent = JSON.stringify(jsonObject, null, 2)
              dataFilename = exactFilename && pageCount === 1
                ? `${finalFilenamePrefix}.json`
                : `${finalFilenamePrefix}_${pageIndex + 1}.json`
              dataPath = `${sftpConfig.jsonPath}/${dataFilename}`
            } catch (error) {
              throw new Error(`Failed to process JSON content: ${error.message}`)
            }
          } else if (formatType === 'CSV') {
            // Handle CSV format
            dataContent = xmlContent
            dataFilename = exactFilename && pageCount === 1
              ? `${finalFilenamePrefix}.csv`
              : `${finalFilenamePrefix}_${pageIndex + 1}.csv`
            if (!sftpConfig.csvPath) {
              throw new Error('CSV Path is not configured in SFTP settings. Please configure CSV Path before uploading CSV files.')
            }
            dataPath = `${sftpConfig.csvPath}/${dataFilename}`
            console.log(`📄 Using CSV format, uploading to: ${dataPath}`)
          } else {
            // Handle XML format (default)
            dataContent = xmlContent

            // Inject ParseIt ID if mapping is provided for XML
            // Direct string replacement for ParseIt ID placeholder
            dataContent = dataContent.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, parseitId.toString())

            dataFilename = exactFilename && pageCount === 1
              ? `${finalFilenamePrefix}.xml`
              : `${finalFilenamePrefix}_${pageIndex + 1}.xml`
            dataPath = `${sftpConfig.xmlPath}/${dataFilename}`
          }
          
          // Upload data file based on file type filters
          let shouldUploadDataFileExtraction = true
          if (formatType === 'JSON' && fileTypeFilters.json === false) {
            shouldUploadDataFileExtraction = false
            console.log(`📄 ⏭️  Skipping JSON file upload (disabled in filters): ${dataPath}`)
          } else if (formatType === 'CSV' && fileTypeFilters.csv === false) {
            shouldUploadDataFileExtraction = false
            console.log(`📄 ⏭️  Skipping CSV file upload (disabled in filters): ${dataPath}`)
          } else if (formatType === 'XML' && fileTypeFilters.xml === false) {
            shouldUploadDataFileExtraction = false
            console.log(`📄 ⏭️  Skipping XML file upload (disabled in filters): ${dataPath}`)
          }

          if (shouldUploadDataFileExtraction) {
            console.log(`📄 Uploading data file: ${dataPath}`)
            await sftp.put(Buffer.from(dataContent, 'utf8'), dataPath)
          }

          // Upload single page PDF file
          const pdfFilename = exactFilename && pageCount === 1
            ? `${finalFilenamePrefix}.pdf`
            : `${finalFilenamePrefix}_${pageIndex + 1}.pdf`
          const pdfPath = `${sftpConfig.pdfPath}/${pdfFilename}`

          let pdfUploadedExtraction = false
          if (fileTypeFilters.pdf === false) {
            console.log(`📄 ⏭️  Skipping PDF upload (disabled in filters): ${pdfPath}`)
          } else {
            // Create a new PDF document with just this page
            const singlePagePdf = await PDFDocument.create()
            const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [pageIndex])
            singlePagePdf.addPage(copiedPage)

            // Convert single page PDF to buffer
            const singlePagePdfBytes = await singlePagePdf.save()
            const singlePageBuffer = Buffer.from(singlePagePdfBytes)

            await sftp.put(singlePageBuffer, pdfPath)
            pdfUploadedExtraction = true
          }

          uploadResults.push({
            page: pageIndex + 1,
            parseitId: parseitId,
            actualFilename: pdfFilename, // Use the actual PDF filename that was uploaded
            dataFilename: dataFilename, // Also include the data filename
            files: {
              data: shouldUploadDataFileExtraction ? dataPath : null,
              pdf: pdfUploadedExtraction ? pdfPath : null
            }
          })
        }
        
        // Log successful extraction for extraction type
        try {
          await logExtraction(
            extractionTypeId || null,
            null, // No transformationTypeId for extraction
            originalFilename || (baseFilename + '.pdf') || 'unknown.pdf',
            pageCount,
            'success',
            null,
            uploadResults?.parseitId // Use the first page's ParseIt ID for the log
          )
        } catch (logError) {
          console.warn('Failed to log successful extraction:', logError)
        }
      }

      await sftp.end()

      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Successfully processed PDF and uploaded ${uploadResults.length} file(s) with unique ParseIt IDs`,
          pageCount: uploadResults.length,
          results: uploadResults,
          actualFilenames: uploadResults.map(r => r.actualFilename), // Return the actual filenames used
          actualFilename: uploadResults?.actualFilename // Return the first page's filename for single responses
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )

    } catch (sftpError) {
      await sftp.end()
      
      // Log failed extraction
      try {
        await logExtraction(
          extractionTypeId || null,
          transformationTypeId || null,
          originalFilename || (baseFilename + '.pdf') || 'unknown.pdf',
          0, // No page count available on failure
          'failed',
          sftpError instanceof Error ? sftpError.message : 'Unknown SFTP error'
        )
      } catch (logError) {
        console.warn('Failed to log failed extraction:', logError)
      }
      
      throw sftpError
    }

  } catch (error) {
    console.error("SFTP upload error:", error)
    
    // Log failed extraction at top level
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (supabaseUrl && supabaseServiceKey) {
        await fetch(`${supabaseUrl}/rest/v1/extraction_logs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            user_id: userId || null,
            extraction_type_id: extractionTypeId || null,
            transformation_type_id: transformationTypeId || null,
            pdf_filename: originalFilename || (baseFilename + '.pdf') || 'unknown.pdf',
            pdf_pages: 0,
            extraction_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            created_at: new Date().toISOString(),
            extracted_data: xmlContent || null
          })
        })
      }
    } catch (logError) {
      console.warn('Failed to log top-level extraction error:', logError)
    }
    
    return new Response(
      JSON.stringify({ 
        error: "SFTP upload failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

// Helper function to inject ParseIt ID into JSON object
function injectParseitId(jsonObject: any, fieldPath: string, parseitId: number): any {
  const pathParts = fieldPath.split('.')
  let current = jsonObject
  
  // Navigate to the parent object
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i]
    if (!current[part]) {
      current[part] = {}
    }
    current = current[part]
  }
  
  // Set the ParseIt ID at the final field
  const finalField = pathParts[pathParts.length - 1]
  current[finalField] = parseitId
  
  return jsonObject
}