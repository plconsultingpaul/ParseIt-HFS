import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Buffer } from "node:buffer"
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface WorkflowExecutionRequest {
  extractedData?: string | null
  extractedDataStoragePath?: string
  workflowId: string
  userId?: string
  extractionTypeId?: string
  transformationTypeId?: string
  pdfFilename: string
  pdfPages: number
  pdfStoragePath?: string
  originalPdfFilename: string
  pdfBase64?: string
}

interface WorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  step_type: string
  step_name: string
  config_json: any
  next_step_on_success_id?: string
  next_step_on_failure_id?: string
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  console.log('🚀 === JSON WORKFLOW PROCESSOR START ===')
  
  // Initialize variables for cleanup
  let workflowExecutionLogId: string | null = null
  let extractionLogId: string | null = null
  
  try {
    // Get Supabase configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase configuration missing')
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log('✅ Supabase configuration loaded')

    // Parse request body with detailed error handling
    let requestData: WorkflowExecutionRequest
    try {
      console.log('📥 Reading request body...')
      const requestText = await req.text()
      console.log('📏 Request body size:', requestText.length, 'characters')
      
      if (!requestText || requestText.trim() === '') {
        throw new Error('Request body is empty')
      }
      
      console.log('🔧 Parsing request JSON...')
      requestData = JSON.parse(requestText)
      console.log('✅ Request parsed successfully')
      console.log('🔑 Request keys:', Object.keys(requestData))
      
    } catch (parseError) {
      console.error('❌ Failed to parse request:', parseError)
      return new Response(
        JSON.stringify({ 
          error: "Invalid request format", 
          details: parseError instanceof Error ? parseError.message : "Unknown parse error"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log('📊 Workflow ID:', requestData.workflowId)
    console.log('👤 User ID:', requestData.userId || 'none')
    console.log('📄 PDF filename:', requestData.pdfFilename)

    // Fetch extraction/transformation type details to get formatType and other properties
    console.log('🔍 === FETCHING TYPE DETAILS ===')
    let typeDetails: any = null
    let formatType = 'JSON' // Default fallback
    
    try {
      if (requestData.extractionTypeId) {
        console.log('📋 Fetching extraction type details for ID:', requestData.extractionTypeId)
        const extractionTypeResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_types?id=eq.${requestData.extractionTypeId}`, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          }
        })
        
        if (extractionTypeResponse.ok) {
          const extractionTypes = await extractionTypeResponse.json()
          if (extractionTypes && extractionTypes.length > 0) {
            typeDetails = extractionTypes[0]
            formatType = typeDetails.format_type || 'JSON'
            console.log('✅ Extraction type details loaded, formatType:', formatType)
          }
        }
      } else if (requestData.transformationTypeId) {
        console.log('📋 Fetching transformation type details for ID:', requestData.transformationTypeId)
        const transformationTypeResponse = await fetch(`${supabaseUrl}/rest/v1/transformation_types?id=eq.${requestData.transformationTypeId}`, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          }
        })
        
        if (transformationTypeResponse.ok) {
          const transformationTypes = await transformationTypeResponse.json()
          if (transformationTypes && transformationTypes.length > 0) {
            typeDetails = transformationTypes[0]
            formatType = 'JSON' // Transformation types are always JSON for filename generation
            console.log('✅ Transformation type details loaded')
          }
        }
      }
      
      console.log('📊 Type details loaded:', !!typeDetails)
      console.log('📊 Format type determined:', formatType)
      
    } catch (typeError) {
      console.error('❌ Failed to fetch type details:', typeError)
      console.log('⚠️ Continuing with default formatType: JSON')
    }

    // Create extraction log entry first
    console.log('📝 Creating extraction log entry...')
    try {
      const extractionLogResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: requestData.userId || null,
          extraction_type_id: requestData.extractionTypeId || null,
          transformation_type_id: requestData.transformationTypeId || null,
          pdf_filename: requestData.originalPdfFilename,
          pdf_pages: requestData.pdfPages,
          extraction_status: 'success',
          extracted_data: requestData.extractedData || null,
          processing_mode: requestData.transformationTypeId ? 'transformation' : 'extraction',
          created_at: new Date().toISOString()
        })
      })

      if (extractionLogResponse.ok) {
        const extractionLogData = await extractionLogResponse.json()
        extractionLogId = extractionLogData[0]?.id
        console.log('✅ Extraction log created with ID:', extractionLogId)
      } else {
        console.error('❌ Failed to create extraction log:', extractionLogResponse.status)
      }
    } catch (logError) {
      console.error('❌ Error creating extraction log:', logError)
    }

    // Create workflow execution log
    console.log('📝 Creating workflow execution log...')
    try {
      const workflowLogPayload = {
        extraction_log_id: extractionLogId,
        workflow_id: requestData.workflowId,
        status: 'running',
        context_data: {},
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      console.log('📝 Workflow log payload:', JSON.stringify(workflowLogPayload, null, 2))
      
      const workflowLogResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(workflowLogPayload)
      })

      console.log('📝 Workflow log response status:', workflowLogResponse.status)
      console.log('📝 Workflow log response ok:', workflowLogResponse.ok)
      
      if (workflowLogResponse.ok) {
        const responseText = await workflowLogResponse.text()
        console.log('📝 Workflow log response text:', responseText)
        
        if (responseText && responseText.trim() !== '') {
          try {
            const workflowLogData = JSON.parse(responseText)
            console.log('📝 Parsed workflow log data:', workflowLogData)
            workflowExecutionLogId = workflowLogData[0]?.id
            console.log('✅ Workflow execution log created with ID:', workflowExecutionLogId)
          } catch (parseError) {
            console.error('❌ Failed to parse workflow log response:', parseError)
            console.error('📝 Raw response that failed to parse:', responseText)
            // Continue without workflow log ID - don't fail the entire process
            console.log('⚠️ Continuing without workflow execution log ID')
          }
        } else {
          console.log('⚠️ Empty response from workflow log creation - continuing without log ID')
        }
      } else {
        const errorText = await workflowLogResponse.text()
        console.error('❌ Failed to create workflow execution log:', workflowLogResponse.status, errorText)
        console.log('⚠️ Continuing without workflow execution log')
      }
    } catch (logError) {
      console.error('❌ Error creating workflow execution log:', logError)
      console.error('❌ Log error type:', logError.constructor.name)
      console.error('❌ Log error message:', logError.message)
      console.log('⚠️ Continuing without workflow execution log')
    }

    // Load extracted data with comprehensive error handling
    let extractedData: any = {}
    console.log('📁 === LOADING EXTRACTED DATA ===')
    
    if (requestData.extractedDataStoragePath) {
      console.log('📁 Loading from storage path:', requestData.extractedDataStoragePath)
      
      try {
        const storageUrl = `${supabaseUrl}/storage/v1/object/pdfs/${requestData.extractedDataStoragePath}`
        console.log('📁 Storage URL:', storageUrl)
        
        const storageResponse = await fetch(storageUrl, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
          }
        })

        console.log('📁 Storage response status:', storageResponse.status)
        console.log('📁 Storage response ok:', storageResponse.ok)

        if (!storageResponse.ok) {
          const errorText = await storageResponse.text()
          console.error('📁 Storage fetch failed:', errorText)
          throw new Error(`Storage fetch failed: ${storageResponse.status} - ${errorText}`)
        }

        const storageText = await storageResponse.text()
        console.log('📁 Storage response length:', storageText.length)
        console.log('📁 Storage response preview (first 200):', storageText.substring(0, 200))
        console.log('📁 Storage response preview (last 100):', storageText.substring(Math.max(0, storageText.length - 100)))
        
        if (!storageText || storageText.trim() === '') {
          console.warn('⚠️ Storage file is empty, using empty object')
          extractedData = {}
        } else {
          console.log('📁 Attempting to parse storage content as JSON...')
          try {
            extractedData = JSON.parse(storageText)
            console.log('✅ Successfully parsed extracted data from storage')
            console.log('📊 Extracted data keys:', Object.keys(extractedData))
          } catch (storageParseError) {
            console.error('❌ Failed to parse storage JSON:', storageParseError)
            console.error('📁 Problematic content:', storageText)
            console.log('📁 Using empty object as fallback')
            extractedData = {}
          }
        }
      } catch (storageError) {
        console.error('❌ Storage loading error:', storageError)
        console.log('📁 Using empty object as fallback')
        extractedData = {}
      }
    } else if (requestData.extractedData) {
      console.log('📊 Processing extracted data from request...')
      try {
        if (typeof requestData.extractedData === 'string') {
          if (requestData.extractedData.trim() === '') {
            console.log('📊 Extracted data is empty string')
            extractedData = {}
          } else {
            console.log('📊 Parsing extracted data string...')
            extractedData = JSON.parse(requestData.extractedData)
            console.log('✅ Parsed extracted data from request')
          }
        } else {
          console.log('📊 Using extracted data object directly')
          extractedData = requestData.extractedData || {}
        }
      } catch (parseError) {
        console.error('❌ Failed to parse extracted data:', parseError)
        extractedData = {}
      }
    } else {
      console.log('📊 No extracted data provided, using empty object')
      extractedData = {}
    }

    console.log('📊 Final extracted data keys:', Object.keys(extractedData))

    // Get workflow steps
    console.log('📋 Fetching workflow steps...')
    const stepsResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_steps?workflow_id=eq.${requestData.workflowId}&order=step_order.asc`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    if (!stepsResponse.ok) {
      throw new Error('Failed to fetch workflow steps')
    }

    const steps: WorkflowStep[] = await stepsResponse.json()
    console.log('📊 Found', steps.length, 'workflow steps')

    if (steps.length === 0) {
      throw new Error('No steps found in workflow')
    }

    // Initialize context data
    let contextData = {
      extractedData: extractedData,
      originalExtractedData: requestData.extractedData, // Keep original string format
      formatType: formatType, // Store format type for later use
      pdfFilename: requestData.pdfFilename,
      originalPdfFilename: requestData.originalPdfFilename,
      pdfStoragePath: requestData.pdfStoragePath,
      pdfBase64: requestData.pdfBase64, // Ensure PDF base64 is available for SFTP upload
      ...extractedData
    }

    console.log('🔄 Starting workflow execution with', steps.length, 'steps...')
    let lastApiResponse: any = null

    // Execute each workflow step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      console.log(`🔄 === EXECUTING STEP ${step.step_order}: ${step.step_name} ===`)
      console.log('🔧 Step type:', step.step_type)

      // Update workflow execution log with current step
      try {
        await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            current_step_id: step.id,
            current_step_name: step.step_name,
            context_data: contextData,
            updated_at: new Date().toISOString()
          })
        })
      } catch (updateError) {
        console.warn('⚠️ Failed to update workflow log:', updateError)
      }

      try {
        if (step.step_type === 'api_call') {
          console.log('🌐 === EXECUTING API CALL STEP ===')
          const config = step.config_json || {}
          console.log('🔧 API call config:', JSON.stringify(config, null, 2))

          // Fetch API settings to get base URL
          console.log('🔍 Fetching API settings for base URL...')
          let baseApiUrl = ''
          try {
            const apiSettingsResponse = await fetch(`${supabaseUrl}/rest/v1/api_settings?order=updated_at.desc&limit=1`, {
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey
              }
            })
            
            if (apiSettingsResponse.ok) {
              const apiSettings = await apiSettingsResponse.json()
              if (apiSettings && apiSettings.length > 0) {
                baseApiUrl = apiSettings[0].path || ''
                console.log('✅ Base API URL loaded:', baseApiUrl)
              } else {
                console.log('⚠️ No API settings found')
              }
            } else {
              console.log('⚠️ Failed to fetch API settings:', apiSettingsResponse.status)
            }
          } catch (apiSettingsError) {
            console.error('❌ Error fetching API settings:', apiSettingsError)
          }

          // Helper function to safely get nested values from an object using dot notation
          const getValueByPath = (obj: any, path: string): any => {
            try {
              const parts = path.split('.')
              let current = obj
              
              for (const part of parts) {
                if (part.includes('[') && part.includes(']')) {
                  // Handle array notation like orders[0]
                  const arrayName = part.substring(0, part.indexOf('['))
                  const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
                  current = current[arrayName]?.[arrayIndex]
                } else {
                  current = current[part]
                }
                
                if (current === undefined || current === null) {
                  return null
                }
              }
              
              return current
            } catch (error) {
              console.error(`Error getting value by path "${path}":`, error)
              return null
            }
          }

          // Replace placeholders in URL
          let url = config.url || ''
          console.log('🔗 Original URL:', url)
          
          // Find all placeholders in the URL using regex
          const urlPlaceholderRegex = /\{\{([^}]+)\}\}/g
          let match
          const replacements: { placeholder: string, path: string, value: any }[] = []
          
          while ((match = urlPlaceholderRegex.exec(url)) !== null) {
            const placeholder = match[0] // Full placeholder like {{orders.0.consignee.name}}
            const path = match[1] // Path like orders.0.consignee.name
            
            console.log(`🔍 Found URL placeholder: ${placeholder} with path: ${path}`)
            
            // Get the value using the path
            const value = getValueByPath(contextData, path)
            replacements.push({ placeholder, path, value })
            
            console.log(`🔍 Path "${path}" resolved to:`, value)
          }
          
          // Apply all replacements
          for (const replacement of replacements) {
            const replacementValue = String(replacement.value || '')
            url = url.replace(new RegExp(replacement.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementValue)
            console.log(`🔄 Replaced ${replacement.placeholder} with: ${replacementValue}`)
          }
          
          // Also handle simple top-level replacements for backward compatibility
          for (const [key, value] of Object.entries(contextData)) {
            const placeholder = `{{${key}}}`
            if (url.includes(placeholder) && !key.includes('.')) {
              const replacementValue = String(value || '')
              url = url.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), replacementValue)
              console.log(`🔄 Replaced simple ${placeholder} with: ${replacementValue}`)
            }
          }
          
          console.log('🔗 Final URL:', url)

          // Check if URL is relative and prepend base API URL if needed
          if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
            if (baseApiUrl) {
              // Ensure baseApiUrl ends with / and url doesn't start with /
              const cleanBaseUrl = baseApiUrl.endsWith('/') ? baseApiUrl.slice(0, -1) : baseApiUrl
              const cleanPath = url.startsWith('/') ? url : `/${url}`
              url = `${cleanBaseUrl}${cleanPath}`
              console.log('🔗 Converted relative URL to absolute:', url)
            } else {
              console.error('❌ Relative URL provided but no base API URL configured')
              throw new Error('Relative URL provided but no base API URL configured in API settings')
            }
          }
          
          console.log('🔗 Final absolute URL:', url)

          // Replace placeholders in request body
          let requestBody = config.requestBody || ''
          console.log('📄 Original request body template:', requestBody)
          
          // Find all placeholders in the request body using regex
          const bodyPlaceholderRegex = /\{\{([^}]+)\}\}/g
          let bodyMatch
          const bodyReplacements: { placeholder: string, path: string, value: any }[] = []
          
          while ((bodyMatch = bodyPlaceholderRegex.exec(requestBody)) !== null) {
            const placeholder = bodyMatch[0] // Full placeholder like {{orders.0.consignee.name}}
            const path = bodyMatch[1] // Path like orders.0.consignee.name
            
            console.log(`🔍 Found request body placeholder: ${placeholder} with path: ${path}`)
            
            // Skip special placeholders that are handled separately
            if (path === 'extractedData' || path === 'orders') {
              console.log(`⏭️ Skipping special placeholder: ${placeholder}`)
              continue
            }
            
            // Get the value using the path
            const value = getValueByPath(contextData, path)
            bodyReplacements.push({ placeholder, path, value })
            
            console.log(`🔍 Path "${path}" resolved to:`, value)
          }
          
          // Apply all replacements first
          for (const replacement of bodyReplacements) {
            const replacementValue = String(replacement.value || '')
            requestBody = requestBody.replace(new RegExp(replacement.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacementValue)
            console.log(`🔄 Replaced ${replacement.placeholder} with: ${replacementValue}`)
          }
          
          // Special handling for complex JSON objects in request body
          if (requestBody.includes('{{extractedData}}')) {
            console.log('🔧 Found {{extractedData}} placeholder - handling as JSON object')
            if (contextData.originalExtractedData && typeof contextData.originalExtractedData === 'string') {
              // Use the original extracted data string directly
              requestBody = requestBody.replace(/\{\{extractedData\}\}/g, contextData.originalExtractedData)
              console.log('✅ Replaced {{extractedData}} with original extracted data string')
            } else if (contextData.extractedData && typeof contextData.extractedData === 'object') {
              // Stringify the extracted data object
              requestBody = requestBody.replace(/\{\{extractedData\}\}/g, JSON.stringify(contextData.extractedData))
              console.log('✅ Replaced {{extractedData}} with stringified extracted data object')
            }
          }
          
          // Special handling for orders array (common in extraction workflows)
          if (requestBody.includes('{{orders}}')) {
            console.log('🔧 Found {{orders}} placeholder - handling as JSON array')
            if (contextData.orders && Array.isArray(contextData.orders)) {
              requestBody = requestBody.replace(/\{\{orders\}\}/g, JSON.stringify(contextData.orders))
              console.log('✅ Replaced {{orders}} with stringified orders array')
            }
          }
          
          console.log('📄 Final request body:', requestBody)

          // *** THIS IS THE SECTION YOU NEED FOR POSTMAN ***
          console.log('🚀 === EXACT API CALL FOR POSTMAN ===')
          console.log('Method:', config.method || 'POST')
          console.log('URL:', url)
          console.log('Headers:', JSON.stringify(config.headers || {}, null, 2))
          console.log('Body:', requestBody)
          console.log('🚀 === END POSTMAN INFO ===')

          // *** DETAILED API CALL LOGGING FOR DEBUGGING ***
          console.log('🔍 === DETAILED API CALL DEBUG ===')
          console.log('🔍 Original config.url:', config.url)
          console.log('🔍 Final processed URL:', url)
          console.log('🔍 HTTP Method:', config.method || 'POST')
          console.log('🔍 Request Headers (raw):', config.headers)
          console.log('🔍 Request Headers (stringified):', JSON.stringify(config.headers || {}, null, 2))
          console.log('🔍 Request Body Template:', config.requestBody)
          console.log('🔍 Final Request Body:', requestBody)
          console.log('🔍 Request Body Length:', requestBody?.length || 0)
          console.log('🔍 Context Data Keys:', Object.keys(contextData))
          console.log('🔍 === END DETAILED DEBUG ===')
          // Make the actual API call
          console.log('📡 Making API call...')
          
          const fetchOptions: any = {
            method: config.method || 'POST',
            headers: config.headers || {}
          }
          
          // Only include body for non-GET requests
          if (config.method && config.method.toUpperCase() !== 'GET' && requestBody && requestBody.trim() !== '') {
            fetchOptions.body = requestBody
            console.log('📄 Including request body for', config.method, 'request')
          } else {
            console.log('🔍 GET request - no body included')
          }
          
          // Log the exact fetch options being used
          console.log('🚀 === ACTUAL FETCH CALL ===')
          console.log('🚀 fetch(url, options) where:')
          console.log('🚀 url =', url)
          console.log('🚀 options =', JSON.stringify(fetchOptions, null, 2))
          console.log('🚀 === END FETCH CALL ===')
          
          const apiResponse = await fetch(url, fetchOptions)

          console.log('📊 API response status:', apiResponse.status)
          console.log('📊 API response ok:', apiResponse.ok)
          console.log('📊 API response headers:', Object.fromEntries(apiResponse.headers.entries()))

          if (!apiResponse.ok) {
            const errorText = await apiResponse.text()
            console.error('❌ API call failed:', errorText)
            console.error('❌ Failed request details:')
            console.error('❌   URL:', url)
            console.error('❌   Method:', config.method || 'POST')
            console.error('❌   Headers:', JSON.stringify(config.headers || {}, null, 2))
            console.error('❌   Body:', requestBody)
            console.error('❌   Response Status:', apiResponse.status)
            console.error('❌   Response Headers:', Object.fromEntries(apiResponse.headers.entries()))
            throw new Error(`API call failed with status ${apiResponse.status}: ${errorText}`)
          }

          const responseText = await apiResponse.text()
          console.log('📏 API response length:', responseText.length)
          console.log('📄 API response preview:', responseText.substring(0, 200))

          if (!responseText || responseText.trim() === '') {
            console.error('❌ API returned empty response')
            throw new Error('API returned empty response body')
          }

          let responseData: any
          try {
            responseData = JSON.parse(responseText)
            console.log('✅ API response parsed successfully')
            lastApiResponse = responseData
          } catch (responseParseError) {
            console.error('❌ Failed to parse API response:', responseParseError)
            console.error('📄 Problematic response:', responseText)
            throw new Error(`API response is not valid JSON: ${responseParseError.message}`)
          }

          // Handle response data extraction if configured
          if (config.responseDataPath && config.updateJsonPath) {
            console.log('🔄 Extracting data from API response...')
            try {
              // Navigate to response data
              const pathParts = config.responseDataPath.split('.')
              let responseValue = responseData
              
              for (const part of pathParts) {
                if (part.includes('[') && part.includes(']')) {
                  const arrayName = part.substring(0, part.indexOf('['))
                  const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
                  responseValue = responseValue[arrayName][arrayIndex]
                } else {
                  responseValue = responseValue[part]
                }
              }
              
              console.log('📊 Extracted value:', responseValue)
              
              // Update context data with proper array/object creation
              const updatePathParts = config.updateJsonPath.split('.')
              let current = contextData
              
              for (let j = 0; j < updatePathParts.length - 1; j++) {
                const part = updatePathParts[j]
                
                if (part.includes('[') && part.includes(']')) {
                  // Handle array notation like orders[0]
                  const arrayName = part.substring(0, part.indexOf('['))
                  const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
                  
                  // Create array if it doesn't exist
                  if (!current[arrayName]) {
                    current[arrayName] = []
                  }
                  
                  // Ensure array has enough elements
                  while (current[arrayName].length <= arrayIndex) {
                    current[arrayName].push({})
                  }
                  
                  current = current[arrayName][arrayIndex]
                } else {
                  // Handle regular object property
                  if (!current[part]) current[part] = {}
                  current = current[part]
                }
              }
              
              const finalPart = updatePathParts[updatePathParts.length - 1]
              
              if (finalPart.includes('[') && finalPart.includes(']')) {
                // Handle array notation in final part
                const arrayName = finalPart.substring(0, finalPart.indexOf('['))
                const arrayIndex = parseInt(finalPart.substring(finalPart.indexOf('[') + 1, finalPart.indexOf(']')))
                
                if (!current[arrayName]) {
                  current[arrayName] = []
                }
                
                while (current[arrayName].length <= arrayIndex) {
                  current[arrayName].push({})
                }
                
                current[arrayName][arrayIndex] = responseValue
              } else {
                // Handle regular property assignment
                current[finalPart] = responseValue
              }
              
              console.log('📊 Updated context data structure:')
              console.log('📊 Context data keys after update:', Object.keys(contextData))
              console.log('📊 Full context data:', JSON.stringify(contextData, null, 2))
              console.log('✅ Updated context data with API response')
            } catch (extractError) {
              console.error('❌ Failed to extract data from API response:', extractError)
            }
          }

        } else if (step.step_type === 'sftp_upload') {
          console.log('📁 === EXECUTING SFTP UPLOAD STEP ===')
          const config = step.config_json || {}
          console.log('🔧 SFTP upload config:', JSON.stringify(config, null, 2))

          // Get SFTP configuration from database
          console.log('📋 Fetching SFTP configuration...')
          const sftpConfigResponse = await fetch(`${supabaseUrl}/rest/v1/sftp_config?order=updated_at.desc&limit=1`, {
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            }
          })

          if (!sftpConfigResponse.ok) {
            throw new Error('Failed to fetch SFTP configuration')
          }

          const sftpConfigs = await sftpConfigResponse.json()
          if (!sftpConfigs || sftpConfigs.length === 0) {
            throw new Error('No SFTP configuration found')
          }

          const sftpConfig = sftpConfigs[0]
          console.log('✅ SFTP configuration loaded')

          // Determine filename for upload
          let uploadFilename = 'document'
          
          // First check if we have a renamed filename from a previous step
          if (contextData.renamedFilename) {
            uploadFilename = contextData.renamedFilename.replace('.pdf', '')
            console.log('📝 Using renamed filename from previous step:', uploadFilename)
          } else if (config.useApiResponseForFilename && config.filenameSourcePath && lastApiResponse) {
            console.log('🔍 Extracting filename from API response...')
            try {
              // Navigate to the filename source in API response
              const pathParts = config.filenameSourcePath.split('.')
              let filenameValue = lastApiResponse
              
              for (const part of pathParts) {
                if (part.includes('[') && part.includes(']')) {
                  const arrayName = part.substring(0, part.indexOf('['))
                  const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
                  filenameValue = filenameValue[arrayName][arrayIndex]
                } else {
                  filenameValue = filenameValue[part]
                }
              }
              
              if (filenameValue) {
                uploadFilename = String(filenameValue).replace(/[<>:"/\\|?*]/g, '_').trim()
                console.log('📝 Extracted filename from API response:', uploadFilename)
              } else {
                console.log('⚠️ Could not extract filename from API response, using fallback')
                uploadFilename = config.fallbackFilename || 'document'
              }
            } catch (extractError) {
              console.error('❌ Failed to extract filename from API response:', extractError)
              uploadFilename = config.fallbackFilename || 'document'
            }
          } else if (config.fallbackFilename) {
            uploadFilename = config.fallbackFilename
            console.log('📝 Using fallback filename:', uploadFilename)
          }

          // Prepare SFTP upload request
          const sftpUploadRequest = {
            sftpConfig: {
              host: sftpConfig.host,
              port: sftpConfig.port,
              username: sftpConfig.username,
              password: sftpConfig.password,
              xmlPath: config.sftpPathOverride || sftpConfig.remote_path || '/uploads/xml/',
              pdfPath: config.sftpPathOverride || sftpConfig.pdf_path || '/uploads/pdf/',
              jsonPath: config.sftpPathOverride || sftpConfig.json_path || '/uploads/json/'
            },
            xmlContent: contextData.originalExtractedData || requestData.extractedData || JSON.stringify(contextData.extractedData || {}),
            pdfBase64: requestData.pdfBase64 || contextData.pdfBase64,
            baseFilename: uploadFilename,
            originalFilename: requestData.originalPdfFilename,
            userId: requestData.userId,
            extractionTypeId: requestData.extractionTypeId,
            transformationTypeId: requestData.transformationTypeId,
            formatType: contextData.formatType || formatType,
            exactFilename: uploadFilename.endsWith('.pdf') ? uploadFilename : `${uploadFilename}.pdf`,
            customFilenamePart: uploadFilename,
            pdfUploadStrategy: config.pdfUploadStrategy || 'all_pages_in_group',
            specificPageToUpload: config.specificPageToUpload
          }
          
          console.log('📊 SFTP upload request PDF strategy config:')
          console.log('📊   pdfUploadStrategy:', config.pdfUploadStrategy || 'all_pages_in_group (default)')
          console.log('📊   specificPageToUpload:', config.specificPageToUpload || 'N/A')
          console.log('📊   Final request pdfUploadStrategy:', sftpUploadRequest.pdfUploadStrategy)
          console.log('📊   Final request specificPageToUpload:', sftpUploadRequest.specificPageToUpload)
          
          console.log('📁 PDF base64 available for SFTP:', !!(requestData.pdfBase64 || contextData.pdfBase64))
          console.log('📁 PDF base64 length:', (requestData.pdfBase64 || contextData.pdfBase64 || '').length)


          console.log('📁 SFTP upload request prepared')
          console.log('📁 Upload filename:', uploadFilename)
          console.log('📁 SFTP path override:', config.sftpPathOverride || 'using default')
          console.log('📁 Format type for SFTP:', contextData.formatType || formatType)
          console.log('📁 Using original extracted data:', !!(contextData.originalExtractedData || requestData.extractedData))
          console.log('📊 === WORKFLOW SFTP UPLOAD STRATEGY DEBUG ===')
          console.log('📊 SFTP upload strategy from step config:')
          console.log('📊   config.pdfUploadStrategy:', config.pdfUploadStrategy || 'all_pages_in_group (default)')
          console.log('📊   config.specificPageToUpload:', config.specificPageToUpload || 'N/A')

          // Ensure we have PDF base64 data - load from storage if needed
          let pdfBase64ForUpload = requestData.pdfBase64 || contextData.pdfBase64
          
          if (!pdfBase64ForUpload && requestData.pdfStoragePath) {
            console.log('📁 Loading PDF from storage:', requestData.pdfStoragePath)
            try {
              const storageUrl = `${supabaseUrl}/storage/v1/object/pdfs/${requestData.pdfStoragePath}`
              const pdfResponse = await fetch(storageUrl, {
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                }
              })
              
              if (pdfResponse.ok) {
                const pdfArrayBuffer = await pdfResponse.arrayBuffer()
                pdfBase64ForUpload = Buffer.from(pdfArrayBuffer).toString('base64')
                console.log('✅ PDF loaded from storage, base64 length:', pdfBase64ForUpload.length)
              } else {
                console.error('❌ Failed to load PDF from storage:', pdfResponse.status)
                throw new Error(`Failed to load PDF from storage: ${pdfResponse.status}`)
              }
            } catch (storageError) {
              console.error('❌ Error loading PDF from storage:', storageError)
              throw new Error(`Error loading PDF from storage: ${storageError.message}`)
            }
          }
          
          if (!pdfBase64ForUpload) {
            throw new Error('No PDF data available for SFTP upload')
          }

          // Call SFTP upload function
          const sftpResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...sftpUploadRequest,
              pdfBase64: pdfBase64ForUpload
            })
          })

          console.log('📁 SFTP upload response status:', sftpResponse.status)
          console.log('📁 SFTP upload response ok:', sftpResponse.ok)

          if (!sftpResponse.ok) {
            const sftpErrorText = await sftpResponse.text()
            console.error('❌ SFTP upload failed:', sftpErrorText)
            throw new Error(`SFTP upload failed: ${sftpResponse.status} - ${sftpErrorText}`)
          }

          const sftpResult = await sftpResponse.json()
          console.log('✅ SFTP upload completed successfully:', sftpResult)
          
          // Extract the actual filename from SFTP response
          let actualUploadedFilename = null
          if (sftpResult.actualFilename) {
            actualUploadedFilename = sftpResult.actualFilename
            console.log('📝 Got actualFilename from SFTP response:', actualUploadedFilename)
          } else if (sftpResult.actualFilenames && sftpResult.actualFilenames.length > 0) {
            actualUploadedFilename = sftpResult.actualFilenames[0]
            console.log('📝 Got actualFilename from SFTP actualFilenames[0]:', actualUploadedFilename)
          } else if (sftpResult.results && sftpResult.results.length > 0) {
            actualUploadedFilename = sftpResult.results[0].actualFilename
            console.log('📝 Got actualFilename from SFTP results[0].actualFilename:', actualUploadedFilename)
          }
          
          // Store the actual filename in context data
          if (actualUploadedFilename) {
            contextData.actualFilename = actualUploadedFilename
            console.log('📝 Stored actualFilename in context:', actualUploadedFilename)
          }

        } else if (step.step_type === 'rename_pdf') {
          console.log('📝 === EXECUTING RENAME PDF STEP ===')
          const config = step.config_json || {}
          console.log('🔧 Rename PDF config:', JSON.stringify(config, null, 2))

          // Generate new filename using template
          let newFilename = config.filenameTemplate || 'renamed_document.pdf'
          console.log('📝 Original filename template:', newFilename)

          if (config.useExtractedData !== false) {
            // Replace placeholders with extracted data
            for (const [key, value] of Object.entries(contextData)) {
              const placeholder = `{{${key}}}`
              if (newFilename.includes(placeholder)) {
                const cleanValue = String(value || '').replace(/[<>:"/\\|?*]/g, '_').trim()
                console.log(`🔄 Replacing ${placeholder} with: ${cleanValue}`)
                newFilename = newFilename.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), cleanValue)
              }
            }
            
            // Handle nested object references like {{orders[0].billNumber}}
            const nestedMatches = newFilename.match(/\{\{([^}]+)\}\}/g)
            if (nestedMatches) {
              for (const match of nestedMatches) {
                const fieldPath = match.replace(/[{}]/g, '')
                console.log(`🔍 Processing nested field path: ${fieldPath}`)
                
                try {
                  // Parse array notation like orders[0].billNumber
                  let value = contextData
                  const parts = fieldPath.split('.')
                  
                  for (const part of parts) {
                    if (part.includes('[') && part.includes(']')) {
                      const arrayName = part.substring(0, part.indexOf('['))
                      const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
                      console.log(`📊 Accessing array: ${arrayName}[${arrayIndex}]`)
                      value = value[arrayName]?.[arrayIndex]
                    } else {
                      console.log(`📊 Accessing property: ${part}`)
                      value = value[part]
                    }
                    
                    if (value === undefined || value === null) {
                      console.log(`⚠️ Value is null/undefined at path: ${part}`)
                      break
                    }
                  }
                  
                  if (value !== undefined && value !== null) {
                    const cleanValue = String(value).replace(/[<>:"/\\|?*]/g, '_').trim()
                    console.log(`🔄 Replacing ${match} with: ${cleanValue}`)
                    newFilename = newFilename.replace(match, cleanValue)
                  } else {
                    console.log(`⚠️ Could not resolve ${fieldPath}, leaving placeholder`)
                  }
                } catch (pathError) {
                  console.error(`❌ Error processing field path ${fieldPath}:`, pathError)
                }
              }
            }
          }

          // Ensure .pdf extension
          if (!newFilename.toLowerCase().endsWith('.pdf')) {
            newFilename += '.pdf'
          }

          // Remove any remaining unreplaced placeholders
          newFilename = newFilename.replace(/\{\{[^}]+\}\}/g, config.fallbackFilename || 'MISSING')

          console.log('📝 Final renamed filename:', newFilename)

          // Store the renamed filename in context for subsequent steps
          contextData.renamedFilename = newFilename
          contextData.exactFilename = newFilename

        } else {
          console.log(`⏭️ Skipping step type: ${step.step_type} (not implemented yet)`)
        }

        console.log(`✅ Step ${step.step_order} completed successfully`)

      } catch (stepError) {
        console.error(`❌ Step ${step.step_order} failed:`, stepError)
        
        // Update logs with failure
        if (workflowExecutionLogId) {
          try {
            await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({
                status: 'failed',
                error_message: stepError.message,
                context_data: contextData,
                updated_at: new Date().toISOString()
              })
            })
          } catch (updateError) {
            console.error('❌ Failed to update workflow log:', updateError)
          }
        }

        const error = new Error(stepError.message)
        error.workflowExecutionLogId = workflowExecutionLogId
        error.extractionLogId = extractionLogId
        throw error
      }
    }

    // Mark workflow as completed
    console.log('✅ === WORKFLOW EXECUTION COMPLETED ===')
    if (workflowExecutionLogId) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            status: 'completed',
            context_data: contextData,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        })
      } catch (updateError) {
        console.error('❌ Failed to update workflow completion:', updateError)
      }
    }

    console.log('🎉 Workflow execution completed successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Workflow executed successfully',
        workflowExecutionLogId: workflowExecutionLogId,
        extractionLogId: extractionLogId,
        finalData: contextData,
        lastApiResponse: lastApiResponse,
        actualFilename: contextData.actualFilename || contextData.renamedFilename // Pass through the actual filename
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("❌ === WORKFLOW EXECUTION ERROR ===")
    console.error("❌ Error type:", error.constructor.name)
    console.error("❌ Error message:", error.message)
    console.error("❌ Error stack:", error.stack)
    
    // Update logs with failure
    if (workflowExecutionLogId) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
          })
        })
      } catch (updateError) {
        console.error('❌ Failed to update workflow log with error:', updateError)
      }
    }
    
    return new Response(
      JSON.stringify({
        error: "Workflow execution failed", 
        details: error instanceof Error ? error.message : "Unknown error",
        workflowExecutionLogId: workflowExecutionLogId,
        extractionLogId: extractionLogId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})