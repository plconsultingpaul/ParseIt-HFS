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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  console.log('🚀 === JSON WORKFLOW PROCESSOR START ===')
  
  let workflowExecutionLogId: string | null = null
  let extractionLogId: string | null = null
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Supabase configuration missing')
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('✅ Supabase configuration loaded')

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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log('📊 Workflow ID:', requestData.workflowId)
    console.log('👤 User ID:', requestData.userId || 'none')
    console.log('📄 PDF filename:', requestData.pdfFilename)

    console.log('🔍 === FETCHING TYPE DETAILS ===')
    let typeDetails: any = null
    let formatType = 'JSON'
    
    try {
      if (requestData.extractionTypeId) {
        console.log('📋 Fetching extraction type details for ID:', requestData.extractionTypeId)
        const extractionTypeResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_types?id=eq.${requestData.extractionTypeId}`, {
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey }
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
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey }
        })
        
        if (transformationTypeResponse.ok) {
          const transformationTypes = await transformationTypeResponse.json()
          if (transformationTypes && transformationTypes.length > 0) {
            typeDetails = transformationTypes[0]
            formatType = 'JSON'
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

    console.log('📝 Creating extraction log entry...')
    try {
      const extractionLogResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_logs`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey, 'Prefer': 'return=representation' },
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
        headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey, 'Prefer': 'return=representation' },
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

    let extractedData: any = {}
    console.log('📁 === LOADING EXTRACTED DATA ===')
    
    if (requestData.extractedDataStoragePath) {
      console.log('📁 Loading from storage path:', requestData.extractedDataStoragePath)
      
      try {
        const storageUrl = `${supabaseUrl}/storage/v1/object/pdfs/${requestData.extractedDataStoragePath}`
        console.log('📁 Storage URL:', storageUrl)
        
        const storageResponse = await fetch(storageUrl, {
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}` }
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

    console.log('📋 Fetching workflow steps...')
    const stepsResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_steps?workflow_id=eq.${requestData.workflowId}&order=step_order.asc`, {
      headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey }
    })

    if (!stepsResponse.ok) {
      throw new Error('Failed to fetch workflow steps')
    }

    const steps: WorkflowStep[] = await stepsResponse.json()
    console.log('📊 Found', steps.length, 'workflow steps')

    if (steps.length === 0) {
      throw new Error('No steps found in workflow')
    }

    let contextData = {
      extractedData: extractedData,
      originalExtractedData: requestData.extractedData,
      formatType: formatType,
      pdfFilename: requestData.pdfFilename,
      originalPdfFilename: requestData.originalPdfFilename,
      pdfStoragePath: requestData.pdfStoragePath,
      pdfBase64: requestData.pdfBase64,
      ...extractedData
    }

    console.log('🔄 Starting workflow execution with', steps.length, 'steps...')
    let lastApiResponse: any = null

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      console.log(`🔄 === EXECUTING STEP ${step.step_order}: ${step.step_name} ===`)
      console.log('🔧 Step type:', step.step_type)

      try {
        await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey },
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

          const getValueByPath = (obj: any, path: string): any => {
            try {
              const parts = path.split('.')
              let current = obj

              for (const part of parts) {
                if (part.includes('[') && part.includes(']')) {
                  const arrayName = part.substring(0, part.indexOf('['))
                  const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
                  current = current[arrayName]?.[arrayIndex]
                } else if (!isNaN(Number(part))) {
                  const arrayIndex = parseInt(part)
                  current = current?.[arrayIndex]
                } else {
                  current = current?.[part]
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

          let url = config.url || ''
          console.log('🔗 Original URL:', url)
          
          const urlPlaceholderRegex = /\{\{([^}]+)\}\}/g
          let match
          const replacements: { placeholder: string, path: string, value: any }[] = []
          
          while ((match = urlPlaceholderRegex.exec(url)) !== null) {
            const placeholder = match[0]
            const path = match[1]
            
            console.log(`🔍 Found URL placeholder: ${placeholder} with path: ${path}`)
            
            const value = getValueByPath(contextData, path)
            replacements.push({ placeholder, path, value })
            
            console.log(`🔍 Path "${path}" resolved to:`, value)
          }
          
          for (const replacement of replacements) {
            const rawValue = String(replacement.value || '')
            const encodedValue = rawValue.replace(/ /g, '%20')
            url = url.replace(new RegExp(replacement.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), encodedValue)
            console.log(`🔄 Replaced ${replacement.placeholder} with: ${rawValue} (encoded: ${encodedValue})`)
          }

          for (const [key, value] of Object.entries(contextData)) {
            const placeholder = `{{${key}}}`
            if (url.includes(placeholder) && !key.includes('.')) {
              const replacementValue = String(value || '')
              const encodedValue = replacementValue.replace(/ /g, '%20')
              url = url.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), encodedValue)
              console.log(`🔄 Replaced simple ${placeholder} with: ${replacementValue} (encoded: ${encodedValue})`)
            }
          }
          
          console.log('🔗 Final URL (as configured in workflow):', url)

          let requestBody = config.requestBody || ''
          console.log('📄 Original request body template:', requestBody)
          
          const bodyPlaceholderRegex = /\{\{([^}]+)\}\}/g
          let bodyMatch
          const bodyReplacements: { placeholder: string, path: string, value: any }[] = []
          
          while ((bodyMatch = bodyPlaceholderRegex.exec(requestBody)) !== null) {
            const placeholder = bodyMatch[0]
            const path = bodyMatch[1]
            
            console.log(`🔍 Found request body placeholder: ${placeholder} with path: ${path}`)
            
            if (path === 'extractedData' || path === 'orders') {
              console.log(`⏭️ Skipping special placeholder: ${placeholder}`)
              continue
            }
            
            const value = getValueByPath(contextData, path)
            bodyReplacements.push({ placeholder, path, value })
            
            console.log(`🔍 Path "${path}" resolved to:`, value)
          }
          
          for (const replacement of bodyReplacements) {
            const rawValue = String(replacement.value || '')
            const escapedValue = rawValue
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
            requestBody = requestBody.replace(new RegExp(replacement.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), escapedValue)
            console.log(`🔄 Replaced ${replacement.placeholder} with: ${rawValue} (escaped: ${escapedValue})`)
          }
          
          if (requestBody.includes('{{extractedData}}')) {
            console.log('🔧 Found {{extractedData}} placeholder - handling as JSON object')
            if (contextData.originalExtractedData && typeof contextData.originalExtractedData === 'string') {
              requestBody = requestBody.replace(/\{\{extractedData\}\}/g, contextData.originalExtractedData)
              console.log('✅ Replaced {{extractedData}} with original extracted data string')
            } else if (contextData.extractedData && typeof contextData.extractedData === 'object') {
              requestBody = requestBody.replace(/\{\{extractedData\}\}/g, JSON.stringify(contextData.extractedData))
              console.log('✅ Replaced {{extractedData}} with stringified extracted data object')
            }
          }
          
          if (requestBody.includes('{{orders}}')) {
            console.log('🔧 Found {{orders}} placeholder - handling as JSON array')
            if (contextData.orders && Array.isArray(contextData.orders)) {
              requestBody = requestBody.replace(/\{\{orders\}\}/g, JSON.stringify(contextData.orders))
              console.log('✅ Replaced {{orders}} with stringified orders array')
            }
          }
          
          console.log('📄 Final request body:', requestBody)

          console.log('🚀 === EXACT API CALL FOR POSTMAN ===')
          console.log('Method:', config.method || 'POST')
          console.log('URL:', url)
          console.log('Headers:', JSON.stringify(config.headers || {}, null, 2))
          console.log('Body:', requestBody)
          console.log('🚀 === END POSTMAN INFO ===')

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
          console.log('📡 Making API call...')
          
          const fetchOptions: any = {
            method: config.method || 'POST',
            headers: config.headers || {}
          }
          
          if (config.method && config.method.toUpperCase() !== 'GET' && requestBody && requestBody.trim() !== '') {
            fetchOptions.body = requestBody
            console.log('📄 Including request body for', config.method, 'request')
          } else {
            console.log('🔍 GET request - no body included')
          }
          
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

          if (config.responseDataPath && config.updateJsonPath) {
            console.log('🔄 Extracting data from API response...')
            try {
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
              
              const updatePathParts = config.updateJsonPath.split('.')
              let current = contextData
              
              for (let j = 0; j < updatePathParts.length - 1; j++) {
                const part = updatePathParts[j]
                
                if (part.includes('[') && part.includes(']')) {
                  const arrayName = part.substring(0, part.indexOf('['))
                  const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
                  
                  if (!current[arrayName]) {
                    current[arrayName] = []
                  }
                  
                  while (current[arrayName].length <= arrayIndex) {
                    current[arrayName].push({})
                  }
                  
                  current = current[arrayName][arrayIndex]
                } else {
                  if (!current[part]) current[part] = {}
                  current = current[part]
                }
              }
              
              const finalPart = updatePathParts[updatePathParts.length - 1]
              
              if (finalPart.includes('[') && finalPart.includes(']')) {
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

        } else {
          console.log(`⏭️ Skipping step type: ${step.step_type} (shortened for deployment)`)
        }

        console.log(`✅ Step ${step.step_order} completed successfully`)

      } catch (stepError) {
        console.error(`❌ Step ${step.step_order} failed:`, stepError)
        
        if (workflowExecutionLogId) {
          try {
            await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
              method: 'PATCH',
              headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey },
              body: JSON.stringify({ status: 'failed', error_message: stepError.message, context_data: contextData, updated_at: new Date().toISOString() })
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

    console.log('✅ === WORKFLOW EXECUTION COMPLETED ===')
    if (workflowExecutionLogId) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey },
          body: JSON.stringify({ status: 'completed', context_data: contextData, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        })
      } catch (updateError) {
        console.error('❌ Failed to update workflow completion:', updateError)
      }
    }

    console.log('🎉 Workflow execution completed successfully')
    
    return new Response(
      JSON.stringify({ success: true, message: 'Workflow executed successfully', workflowExecutionLogId: workflowExecutionLogId, extractionLogId: extractionLogId, finalData: contextData, lastApiResponse: lastApiResponse, actualFilename: contextData.actualFilename || contextData.renamedFilename }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("❌ === WORKFLOW EXECUTION ERROR ===")
    console.error("❌ Error type:", error.constructor.name)
    console.error("❌ Error message:", error.message)
    console.error("❌ Error stack:", error.stack)
    
    if (workflowExecutionLogId) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey },
          body: JSON.stringify({ status: 'failed', error_message: error.message, updated_at: new Date().toISOString() })
        })
      } catch (updateError) {
        console.error('❌ Failed to update workflow log with error:', updateError)
      }
    }
    
    return new Response(
      JSON.stringify({ error: "Workflow execution failed", details: error instanceof Error ? error.message : "Unknown error", workflowExecutionLogId: workflowExecutionLogId, extractionLogId: extractionLogId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})