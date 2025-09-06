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
  }
  xmlContent: string
  pdfBase64: string
  baseFilename: string
  originalFilename?: string
  parseitIdMapping?: string
  useExistingParseitId?: number
  userId?: string
  extractionTypeId?: string
  formatType?: string
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const { sftpConfig, xmlContent, pdfBase64, baseFilename, originalFilename, parseitIdMapping, useExistingParseitId, userId, extractionTypeId, formatType }: UploadRequest = await req.json()

    console.log('SFTP Upload Request received:')
    console.log('- useExistingParseitId:', useExistingParseitId)
    console.log('- parseitIdMapping:', parseitIdMapping)
    console.log('- userId:', userId)
    console.log('- extractionTypeId:', extractionTypeId)
    console.log('- originalFilename:', originalFilename)

    // Validate required fields
    if (!sftpConfig.host || !sftpConfig.username || !xmlContent || !pdfBase64 || !baseFilename) {
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
      
      console.log(`PDF has ${pageCount} pages`)
      
      // Get Supabase configuration
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase configuration missing')
      }

      // Helper function to log extraction
      const logExtraction = async (
        extractionTypeIdParam: string | null,
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
            pdf_filename: pdfFilename,
            pdf_pages: pdfPages,
            extraction_status: status,
            error_message: errorMessage || null,
            extracted_data: xmlContent || null,
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
      // Connect to SFTP server once
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

      const uploadResults = []

      // Process each page separately
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        console.log(`Processing page ${pageIndex + 1} of ${pageCount}`)
        
        let parseitId: number
        
        // For the first page, use existing ParseIt ID if provided
        if (pageIndex === 0 && useExistingParseitId !== undefined && useExistingParseitId !== null && typeof useExistingParseitId === 'number') {
          parseitId = useExistingParseitId
          console.log(`Page ${pageIndex + 1} - Using existing ParseIt ID from JSON:`, parseitId)
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
          console.log(`Page ${pageIndex + 1} - Generated new ParseIt ID:`, parseitId)
          
          if (!parseitId || typeof parseitId !== 'number') {
            console.error('Invalid ParseIt ID received:', parseitId)
            throw new Error(`Invalid ParseIt ID received for page ${pageIndex + 1}`)
          }
        }
        
        const finalFilename = `${baseFilename}_${parseitId}`

        // Create a new PDF document with just this page
        const singlePagePdf = await PDFDocument.create()
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [pageIndex])
        singlePagePdf.addPage(copiedPage)
        
        // Convert single page PDF to buffer
        const singlePagePdfBytes = await singlePagePdf.save()
        const singlePageBuffer = Buffer.from(singlePagePdfBytes)

        // Upload data file (XML or JSON based on content)
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
            dataFilename = `${finalFilename}.json`
            dataPath = `${sftpConfig.jsonPath}/${dataFilename}`
          } catch (error) {
            throw new Error(`Failed to process JSON content: ${error.message}`)
          }
        } else {
          // Handle XML format (default)
          dataContent = xmlContent
          
          // Inject ParseIt ID if mapping is provided for XML
          // Direct string replacement for ParseIt ID placeholder
          dataContent = dataContent.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, parseitId.toString())
          
          dataFilename = `${finalFilename}.xml`
          dataPath = `${sftpConfig.xmlPath}/${dataFilename}`
        }
        
        await sftp.put(Buffer.from(dataContent, 'utf8'), dataPath)

        // Upload single page PDF file
        const pdfFilename = `${finalFilename}.pdf`
        const pdfPath = `${sftpConfig.pdfPath}/${pdfFilename}`
        await sftp.put(singlePageBuffer, pdfPath)

        uploadResults.push({
          page: pageIndex + 1,
          parseitId: parseitId,
          filename: finalFilename,
          files: {
            data: dataPath,
            pdf: pdfPath
          }
        })
      }

      await sftp.end()

      // Log successful extraction
      try {
        await logExtraction(
          extractionTypeId || null,
          originalFilename || (baseFilename + '.pdf') || 'unknown.pdf',
          pageCount,
          'success',
          null,
          uploadResults[0]?.parseitId // Use the first page's ParseIt ID for the log
        )
      } catch (logError) {
        console.warn('Failed to log successful extraction:', logError)
      }
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Successfully split PDF into ${pageCount} pages and uploaded with unique ParseIt IDs`,
          pageCount: pageCount,
          results: uploadResults
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
