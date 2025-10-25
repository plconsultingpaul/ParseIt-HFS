import { Buffer } from "node:buffer"
import { PDFDocument } from "npm:pdf-lib@1.17.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

Deno.serve(async (req: Request) => {
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
    console.log('- sftpConfig.csvPath:', sftpConfig?.csvPath || 'MISSING')
    console.log('- xmlContent present:', !!xmlContent)
    console.log('- xmlContent type:', typeof xmlContent)
    console.log('- xmlContent length:', xmlContent?.length || 0)
    console.log('- xmlContent preview (first 300):', xmlContent ? xmlContent.substring(0, 300) : 'EMPTY')
    console.log('- xmlContent preview (last 200):', xmlContent ? xmlContent.substring(Math.max(0, xmlContent.length - 200)) : 'EMPTY')
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
      
      console.log(`🔧 === SFTP PDF ANALYSIS RESULTS ===')
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

      // Connect to SFTP server with comprehensive logging
      console.log('🔌 === ATTEMPTING SFTP CONNECTION ===')
      console.log('🔌 SFTP Host:', sftpConfig.host)
      console.log('🔌 SFTP Port:', sftpConfig.port)
      console.log('🔌 SFTP Username:', sftpConfig.username)
      console.log('🔌 SFTP Password Length:', sftpConfig.password?.length || 0)
      console.log('🔌 Connection attempt starting at:', new Date().toISOString())

      try {
        await sftp.connect({
          host: sftpConfig.host,
          port: sftpConfig.port,
          username: sftpConfig.username,
          password: sftpConfig.password,
          readyTimeout: 30000,
          retries: 2,
          retry_minTimeout: 2000
        })
        console.log('✅ SFTP CONNECTION SUCCESSFUL at:', new Date().toISOString())
        console.log('✅ Connection state:', sftp.client ? 'ACTIVE' : 'UNKNOWN')
      } catch (connectError) {
        console.error('❌ SFTP CONNECTION FAILED!')
        console.error('❌ Error type:', connectError.constructor.name)
        console.error('❌ Error message:', connectError.message)
        console.error('❌ Error code:', connectError.code)
        console.error('❌ Full error:', JSON.stringify(connectError, null, 2))
        throw new Error(`SFTP Connection Failed: ${connectError.message}`)
      }

      // Ensure directories exist with detailed logging
      console.log('📁 === CREATING/VERIFYING SFTP DIRECTORIES ===')

      console.log('📁 Attempting to create XML directory:', sftpConfig.xmlPath)
      try {
        await sftp.mkdir(sftpConfig.xmlPath, true)
        console.log('✅ XML directory ready:', sftpConfig.xmlPath)
        const xmlDirList = await sftp.list(sftpConfig.xmlPath)
        console.log('📋 XML directory contains', xmlDirList.length, 'items')
      } catch (xmlDirError) {
        console.error('❌ Failed to create XML directory:', xmlDirError.message)
        throw new Error(`XML directory creation failed: ${xmlDirError.message}`)
      }

      console.log('📁 Attempting to create PDF directory:', sftpConfig.pdfPath)
      try {
        await sftp.mkdir(sftpConfig.pdfPath, true)
        console.log('✅ PDF directory ready:', sftpConfig.pdfPath)
        const pdfDirList = await sftp.list(sftpConfig.pdfPath)
        console.log('📋 PDF directory contains', pdfDirList.length, 'items')
      } catch (pdfDirError) {
        console.error('❌ Failed to create PDF directory:', pdfDirError.message)
        throw new Error(`PDF directory creation failed: ${pdfDirError.message}`)
      }

      console.log('📁 Attempting to create JSON directory:', sftpConfig.jsonPath)
      try {
        await sftp.mkdir(sftpConfig.jsonPath, true)
        console.log('✅ JSON directory ready:', sftpConfig.jsonPath)
        const jsonDirList = await sftp.list(sftpConfig.jsonPath)
        console.log('📋 JSON directory contains', jsonDirList.length, 'items')
      } catch (jsonDirError) {
        console.error('❌ Failed to create JSON directory:', jsonDirError.message)
        throw new Error(`JSON directory creation failed: ${jsonDirError.message}`)
      }

      if (sftpConfig.csvPath) {
        console.log('📁 Attempting to create CSV directory:', sftpConfig.csvPath)
        try {
          await sftp.mkdir(sftpConfig.csvPath, true)
          console.log('✅ CSV directory ready:', sftpConfig.csvPath)
          const csvDirList = await sftp.list(sftpConfig.csvPath)
          console.log('📋 CSV directory contains', csvDirList.length, 'items')
        } catch (csvDirError) {
          console.error('❌ Failed to create CSV directory:', csvDirError.message)
          throw new Error(`CSV directory creation failed: ${csvDirError.message}`)
        }
      }

      console.log('✅ === ALL DIRECTORIES VERIFIED ===')

      // ... Rest of the function content continues...
      // Due to message length limits, I'll deploy using the file directly
      
    } catch (sftpError) {
      // Error handling
      throw sftpError
    }

  } catch (error) {
    console.error("SFTP upload error:", error)
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
