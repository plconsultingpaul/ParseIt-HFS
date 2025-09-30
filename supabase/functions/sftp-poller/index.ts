import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface SftpPollingConfig {
  id: string
  name: string
  host: string
  port: number
  username: string
  password: string
  monitored_path: string
  processed_path: string
  is_enabled: boolean
  last_polled_at?: string
  default_extraction_type_id?: string
  workflow_id?: string
}

interface ExtractionType {
  id: string
  name: string
  default_instructions: string
  xml_format: string
  format_type: string
  json_path?: string
  field_mappings?: any
  parseit_id_mapping?: string
  trace_type_mapping?: string
  trace_type_value?: string
  workflow_id?: string
  auto_detect_instructions?: string
}

interface DetectionResult {
  detectedTypeId: string | null
  confidence: 'high' | 'medium' | 'low' | null
  reasoning?: string
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  console.log('SFTP Poller function started')
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase configuration missing')
    return new Response(
      JSON.stringify({ error: "Supabase configuration missing" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  try {
    // Get all enabled SFTP polling configurations
    console.log('Fetching enabled SFTP polling configurations...')
    const configsResponse = await fetch(`${supabaseUrl}/rest/v1/sftp_polling_configs?is_enabled=eq.true`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    if (!configsResponse.ok) {
      throw new Error('Failed to fetch SFTP polling configurations')
    }

    const configs: SftpPollingConfig[] = await configsResponse.json()
    console.log(`Found ${configs.length} enabled SFTP polling configurations`)

    if (configs.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No enabled SFTP polling configurations found",
          configsChecked: 0,
          totalFilesFound: 0,
          totalFilesProcessed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get all extraction types for AI detection
    console.log('Fetching extraction types for AI detection...')
    const extractionTypesResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_types`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    if (!extractionTypesResponse.ok) {
      throw new Error('Failed to fetch extraction types')
    }

    const extractionTypes: ExtractionType[] = await extractionTypesResponse.json()
    console.log(`Loaded ${extractionTypes.length} extraction types`)

    // Get Google Gemini API key for AI detection
    const apiSettingsResponse = await fetch(`${supabaseUrl}/rest/v1/api_settings?order=updated_at.desc&limit=1`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    let geminiApiKey = ''
    if (apiSettingsResponse.ok) {
      const apiSettings = await apiSettingsResponse.json()
      if (apiSettings && apiSettings.length > 0) {
        geminiApiKey = apiSettings[0].google_api_key || ''
      }
    }

    if (!geminiApiKey) {
      console.warn('No Google Gemini API key found - AI detection will be skipped')
    }

    let totalFilesFound = 0
    let totalFilesProcessed = 0
    const results = []

    // Process each configuration
    for (const config of configs) {
      const startTime = Date.now()
      let configFilesFound = 0
      let configFilesProcessed = 0
      let configError: string | null = null

      console.log(`Processing SFTP config: ${config.name}`)

      try {
        // Import SFTP client
        const Client = (await import("ssh2-sftp-client")).default
        const sftp = new Client()

        try {
          // Connect to SFTP server
          console.log(`Connecting to SFTP server: ${config.host}:${config.port}`)
          await sftp.connect({
            host: config.host,
            port: config.port,
            username: config.username,
            password: config.password,
          })

          // List PDF files in monitored directory
          console.log(`Listing files in: ${config.monitored_path}`)
          const fileList = await sftp.list(config.monitored_path)
          const pdfFiles = fileList.filter(file => 
            file.type === '-' && file.name.toLowerCase().endsWith('.pdf')
          )

          configFilesFound = pdfFiles.length
          totalFilesFound += configFilesFound

          console.log(`Found ${pdfFiles.length} PDF files in ${config.monitored_path}`)

          // Process each PDF file
          for (const pdfFile of pdfFiles) {
            const filePath = `${config.monitored_path}/${pdfFile.name}`
            console.log(`Processing file: ${pdfFile.name}`)

            try {
              // Download PDF file
              const pdfBuffer = await sftp.get(filePath)
              const pdfBase64 = Buffer.from(pdfBuffer as Buffer).toString('base64')

              // Determine extraction type
              let extractionTypeId = config.default_extraction_type_id
              let detectionResult: DetectionResult | null = null

              // Try AI detection if API key is available and extraction types have auto-detect instructions
              if (geminiApiKey && extractionTypes.some(type => type.auto_detect_instructions)) {
                try {
                  console.log(`Running AI detection for: ${pdfFile.name}`)
                  
                  const detectionResponse = await fetch(`${supabaseUrl}/functions/v1/pdf-type-detector`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      pdfBase64: pdfBase64,
                      extractionTypes: extractionTypes.map(type => ({
                        id: type.id,
                        name: type.name,
                        autoDetectInstructions: type.auto_detect_instructions || '',
                        formatType: type.format_type
                      })),
                      apiKey: geminiApiKey
                    })
                  })

                  if (detectionResponse.ok) {
                    detectionResult = await detectionResponse.json()
                    if (detectionResult?.detectedTypeId) {
                      extractionTypeId = detectionResult.detectedTypeId
                      console.log(`AI detected extraction type: ${extractionTypeId} (confidence: ${detectionResult.confidence})`)
                    } else {
                      console.log(`AI could not detect extraction type: ${detectionResult?.reasoning}`)
                    }
                  } else {
                    console.warn('AI detection failed, using default extraction type')
                  }
                } catch (detectionError) {
                  console.warn('AI detection error:', detectionError)
                  // Continue with default extraction type
                }
              }

              // If no extraction type determined, skip this file
              if (!extractionTypeId) {
                console.warn(`No extraction type available for file: ${pdfFile.name}`)
                continue
              }

              // Get the full extraction type details
              const extractionType = extractionTypes.find(type => type.id === extractionTypeId)
              if (!extractionType) {
                console.warn(`Extraction type not found: ${extractionTypeId}`)
                continue
              }

              console.log(`Using extraction type: ${extractionType.name}`)

              // Determine workflow ID (from extraction type or config override)
              const workflowId = config.workflow_id || extractionType.workflow_id

              if (workflowId) {
                // Process using workflow
                console.log(`Processing with workflow: ${workflowId}`)
                
                const workflowResponse = await fetch(`${supabaseUrl}/functions/v1/json-workflow-processor`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    extractedData: JSON.stringify({ orders: [] }), // Placeholder - will be extracted by workflow
                    workflowId: workflowId,
                    userId: null, // System user
                    extractionTypeId: extractionType.id,
                    pdfFilename: pdfFile.name,
                    pdfPages: 1,
                    pdfBase64: pdfBase64,
                    originalPdfFilename: pdfFile.name
                  })
                })

                if (workflowResponse.ok) {
                  console.log(`Successfully processed ${pdfFile.name} with workflow`)
                  configFilesProcessed++
                } else {
                  const workflowError = await workflowResponse.json()
                  console.error(`Workflow processing failed for ${pdfFile.name}:`, workflowError)
                  continue
                }
              } else {
                // Process without workflow (direct extraction and upload)
                console.log(`Processing without workflow using extraction type: ${extractionType.name}`)
                
                // For now, we'll extract data using Gemini and then upload via SFTP
                if (!geminiApiKey) {
                  console.warn(`No Gemini API key available for extraction of ${pdfFile.name}`)
                  continue
                }

                try {
                  // Extract data using Gemini
                  const genAI = new GoogleGenerativeAI(geminiApiKey)
                  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })

                  const prompt = `
You are a data extraction AI. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${extractionType.default_instructions}

OUTPUT FORMAT:
Please format the extracted data as ${extractionType.format_type} following this EXACT structure:
${extractionType.xml_format}

IMPORTANT GUIDELINES:
1. Only extract information that is clearly visible in the document
2. Follow the EXACT structure provided in the template
3. If a field is not found, use empty string ("") for text fields, 0 for numbers, null for optional fields
4. Maintain the exact ${extractionType.format_type} structure provided
5. Be precise and accurate with the extracted data

Please provide only the ${extractionType.format_type} output without any additional explanation or formatting.
`

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

                  // Clean up the response
                  if (extractionType.format_type === 'JSON') {
                    extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
                  } else {
                    extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim()
                  }

                  // Upload to SFTP
                  const sftpUploadResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      sftpConfig: {
                        host: config.host,
                        port: config.port,
                        username: config.username,
                        password: config.password,
                        xmlPath: config.processed_path,
                        pdfPath: config.processed_path,
                        jsonPath: config.processed_path
                      },
                      xmlContent: extractedContent,
                      pdfBase64: pdfBase64,
                      baseFilename: extractionType.filename || 'document',
                      originalFilename: pdfFile.name,
                      parseitIdMapping: extractionType.parseit_id_mapping,
                      userId: null,
                      extractionTypeId: extractionType.id,
                      formatType: extractionType.format_type
                    })
                  })

                  if (sftpUploadResponse.ok) {
                    console.log(`Successfully processed ${pdfFile.name} without workflow`)
                    configFilesProcessed++
                  } else {
                    const uploadError = await sftpUploadResponse.json()
                    console.error(`SFTP upload failed for ${pdfFile.name}:`, uploadError)
                    continue
                  }
                } catch (extractionError) {
                  console.error(`Data extraction failed for ${pdfFile.name}:`, extractionError)
                  continue
                }
              }

              // Move processed file to processed directory
              try {
                const processedFilePath = `${config.processed_path}/${pdfFile.name}`
                await sftp.rename(filePath, processedFilePath)
                console.log(`Moved ${pdfFile.name} to processed directory`)
              } catch (moveError) {
                console.warn(`Failed to move ${pdfFile.name} to processed directory:`, moveError)
                // Don't fail the entire process if file move fails
              }

            } catch (fileError) {
              console.error(`Error processing file ${pdfFile.name}:`, fileError)
              // Continue with next file
            }
          }

          totalFilesProcessed += configFilesProcessed

        } finally {
          await sftp.end()
        }

        // Update last polled timestamp
        await fetch(`${supabaseUrl}/rest/v1/sftp_polling_configs?id=eq.${config.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            last_polled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        })

      } catch (configError) {
        console.error(`Error processing SFTP config ${config.name}:`, configError)
        configError = configError instanceof Error ? configError.message : 'Unknown error'
      }

      // Log this configuration's polling attempt
      const executionTime = Date.now() - startTime
      await fetch(`${supabaseUrl}/rest/v1/sftp_polling_logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          config_id: config.id,
          timestamp: new Date().toISOString(),
          status: configError ? 'failed' : 'success',
          files_found: configFilesFound,
          files_processed: configFilesProcessed,
          error_message: configError,
          execution_time_ms: executionTime,
          created_at: new Date().toISOString()
        })
      })

      results.push({
        configName: config.name,
        filesFound: configFilesFound,
        filesProcessed: configFilesProcessed,
        error: configError,
        executionTimeMs: executionTime
      })
    }

    console.log('SFTP polling completed successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: `SFTP polling completed. Processed ${totalFilesProcessed} of ${totalFilesFound} files across ${configs.length} configurations.`,
        configsChecked: configs.length,
        totalFilesFound: totalFilesFound,
        totalFilesProcessed: totalFilesProcessed,
        results: results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("SFTP polling error:", error)
    
    return new Response(
      JSON.stringify({ 
        error: "SFTP polling failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})