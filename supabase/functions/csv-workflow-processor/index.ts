import { Buffer } from "node:buffer"
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

async function createStepLog(
  supabaseUrl: string,
  supabaseServiceKey: string,
  workflowExecutionLogId: string,
  workflowId: string,
  step: WorkflowStep,
  status: string,
  startedAt: string,
  completedAt?: string,
  durationMs?: number,
  errorMessage?: string,
  inputData?: any,
  outputData?: any
) {
  try {
    const stepLogPayload = {
      workflow_execution_log_id: workflowExecutionLogId,
      workflow_id: workflowId,
      step_id: step.id,
      step_name: step.step_name,
      step_type: step.step_type,
      step_order: step.step_order,
      status,
      started_at: startedAt,
      completed_at: completedAt || null,
      duration_ms: durationMs || null,
      error_message: errorMessage || null,
      input_data: inputData || null,
      output_data: outputData || null,
      created_at: new Date().toISOString()
    }

    const stepLogResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_step_logs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(stepLogPayload)
    })

    if (stepLogResponse.ok) {
      const stepLogData = await stepLogResponse.json()
      console.log(`✅ Step log created for step ${step.step_order}:`, stepLogData[0]?.id)
      return stepLogData[0]?.id
    } else {
      console.error('❌ Failed to create step log:', stepLogResponse.status)
    }
  } catch (error) {
    console.error('❌ Error creating step log:', error)
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  console.log('🚀 === CSV WORKFLOW PROCESSOR START ===')

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
    let formatType = 'CSV'

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
            formatType = typeDetails.format_type || 'CSV'
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
            formatType = typeDetails.format_type || 'CSV'
            console.log('✅ Transformation type details loaded')
          }
        }
      }

      console.log('📊 Type details loaded:', !!typeDetails)
      console.log('📊 Format type determined:', formatType)

    } catch (typeError) {
      console.error('❌ Failed to fetch type details:', typeError)
      console.log('⚠️ Continuing with default formatType: CSV')
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
      console.log('📊 Format type:', formatType)
      try {
        if (typeof requestData.extractedData === 'string') {
          if (requestData.extractedData.trim() === '') {
            console.log('📊 Extracted data is empty string')
            extractedData = {}
          } else if (formatType === 'CSV') {
            console.log('📊 CSV format detected - keeping data as string')
            extractedData = requestData.extractedData
            console.log('✅ CSV data preserved as string')
          } else {
            console.log('📊 Parsing extracted data string as JSON...')
            extractedData = JSON.parse(requestData.extractedData)
            console.log('✅ Parsed extracted data from request')
          }
        } else {
          console.log('📊 Using extracted data object directly')
          extractedData = requestData.extractedData || {}
        }
      } catch (parseError) {
        console.error('❌ Failed to parse extracted data:', parseError)
        if (formatType === 'CSV' && typeof requestData.extractedData === 'string') {
          console.log('📊 Parse failed but formatType is CSV - using raw string')
          extractedData = requestData.extractedData
        } else {
          extractedData = {}
        }
      }
    } else {
      console.log('📊 No extracted data provided, using empty object')
      extractedData = {}
    }

    if (typeof extractedData === 'string') {
      console.log('📊 Final extracted data: CSV string with length', extractedData.length)
    } else {
      console.log('📊 Final extracted data keys:', Object.keys(extractedData))
    }

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

    let contextData: any = {
      extractedData: extractedData,
      originalExtractedData: requestData.extractedData,
      formatType: formatType,
      pdfFilename: requestData.pdfFilename,
      originalPdfFilename: requestData.originalPdfFilename,
      pdfStoragePath: requestData.pdfStoragePath,
      pdfBase64: requestData.pdfBase64
    }

    if (formatType !== 'CSV' && typeof extractedData === 'object' && extractedData !== null) {
      contextData = {
        ...contextData,
        ...extractedData
      }
      console.log('📊 Context data merged with extracted data object')
    } else {
      console.log('📊 Context data created without spreading (CSV format or non-object data)')
    }

    console.log('🔄 Starting workflow execution with', steps.length, 'steps...')
    let lastApiResponse: any = null

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

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const stepStartTime = new Date().toISOString()
      const stepStartMs = Date.now()

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

      let stepOutputData: any = null

      try {
        if (step.step_type === 'api_call') {
          console.log('🌐 === EXECUTING API CALL STEP ===')
          const config = step.config_json || {}
          console.log('🔧 API call config:', JSON.stringify(config, null, 2))

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
            const encodedValue = rawValue
            const placeholderEscaped = replacement.placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            url = url.replace(new RegExp(placeholderEscaped, 'g'), encodedValue)
            console.log(`🔄 Replaced ${replacement.placeholder} with: ${rawValue}`)
          }

          for (const [key, value] of Object.entries(contextData)) {
            const placeholder = `{{${key}}}`
            if (url.includes(placeholder) && !key.includes('.')) {
              const replacementValue = String(value || '')
              const encodedValue = replacementValue
              url = url.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), encodedValue)
              console.log(`🔄 Replaced simple ${placeholder} with: ${replacementValue}`)
            }
          }

          console.log('🔗 Final URL:', url)

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
            console.log(`🔄 Replaced ${replacement.placeholder} with: ${rawValue}`)
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

          console.log('🚀 Making API call...')

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

          const apiResponse = await fetch(url, fetchOptions)

          console.log('📊 API response status:', apiResponse.status)
          console.log('📊 API response ok:', apiResponse.ok)

          if (!apiResponse.ok) {
            const errorText = await apiResponse.text()
            console.error('❌ API call failed:', errorText)
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
            stepOutputData = responseData
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

              console.log('✅ Updated context data with API response')
            } catch (extractError) {
              console.error('❌ Failed to extract data from API response:', extractError)
            }
          }

        } else if (step.step_type === 'rename_file' || step.step_type === 'rename_pdf') {
          console.log('📝 === EXECUTING RENAME FILE STEP ===')
          const config = step.config_json || {}
          console.log('🔧 Rename config:', JSON.stringify(config, null, 2))

          // Support both 'template' (legacy) and 'filenameTemplate' (new)
          let template = config.filenameTemplate || config.template || 'Remit_{{pdfFilename}}'
          console.log('📄 Original template:', template)

          // Replace placeholders in the template
          const placeholderRegex = /\{\{([^}]+)\}\}/g
          let match

          while ((match = placeholderRegex.exec(template)) !== null) {
            const placeholder = match[0]
            const path = match[1]
            const value = getValueByPath(contextData, path)

            console.log(`🔍 Replacing ${placeholder} with value:`, value)

            if (value !== null && value !== undefined) {
              template = template.replace(placeholder, String(value))
            }
          }

          // Remove any existing file extensions from the template
          let baseFilename = template.replace(/\.(pdf|csv|json|xml)$/i, '')
          console.log('📄 Base filename (without extension):', baseFilename)

          // Check if timestamp should be appended
          const appendTimestamp = config.appendTimestamp === true
          const timestampFormat = config.timestampFormat || 'YYYYMMDD'

          console.log('⏰ Append timestamp:', appendTimestamp)
          if (appendTimestamp) {
            console.log('⏰ Timestamp format:', timestampFormat)
          }

          // Generate timestamp if required
          let timestamp = ''
          if (appendTimestamp) {
            const now = new Date()
            const year = now.getFullYear()
            const month = String(now.getMonth() + 1).padStart(2, '0')
            const day = String(now.getDate()).padStart(2, '0')
            const hours = String(now.getHours()).padStart(2, '0')
            const minutes = String(now.getMinutes()).padStart(2, '0')
            const seconds = String(now.getSeconds()).padStart(2, '0')

            switch (timestampFormat) {
              case 'YYYYMMDD':
                timestamp = `${year}${month}${day}`
                break
              case 'YYYY-MM-DD':
                timestamp = `${year}-${month}-${day}`
                break
              case 'YYYYMMDD_HHMMSS':
                timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`
                break
              case 'YYYY-MM-DD_HH-MM-SS':
                timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
                break
              default:
                timestamp = `${year}${month}${day}`
            }

            console.log('⏰ Generated timestamp:', timestamp)
            baseFilename = `${baseFilename}_${timestamp}`
            console.log('📄 Base filename with timestamp:', baseFilename)
          }

          // Determine which file types to rename based on config
          const renamePdf = config.renamePdf === true
          const renameCsv = config.renameCsv === true
          const renameJson = config.renameJson === true
          const renameXml = config.renameXml === true

          console.log('📋 File types to rename:', { renamePdf, renameCsv, renameJson, renameXml })

          const renamedFilenames: any = {}

          // Generate renamed filenames for each selected file type
          if (renamePdf) {
            contextData.renamedPdfFilename = `${baseFilename}.pdf`
            renamedFilenames.pdf = contextData.renamedPdfFilename
            console.log('✅ Renamed PDF filename:', contextData.renamedPdfFilename)
          }

          if (renameCsv) {
            contextData.renamedCsvFilename = `${baseFilename}.csv`
            renamedFilenames.csv = contextData.renamedCsvFilename
            console.log('✅ Renamed CSV filename:', contextData.renamedCsvFilename)
          }

          if (renameJson) {
            contextData.renamedJsonFilename = `${baseFilename}.json`
            renamedFilenames.json = contextData.renamedJsonFilename
            console.log('✅ Renamed JSON filename:', contextData.renamedJsonFilename)
          }

          if (renameXml) {
            contextData.renamedXmlFilename = `${baseFilename}.xml`
            renamedFilenames.xml = contextData.renamedXmlFilename
            console.log('✅ Renamed XML filename:', contextData.renamedXmlFilename)
          }

          // For backward compatibility, set renamedFilename and actualFilename to the first enabled type
          // Priority: CSV > PDF > JSON > XML (based on formatType)
          let primaryFilename = baseFilename
          if (formatType === 'CSV' && renameCsv) {
            primaryFilename = contextData.renamedCsvFilename
          } else if (formatType === 'JSON' && renameJson) {
            primaryFilename = contextData.renamedJsonFilename
          } else if (formatType === 'XML' && renameXml) {
            primaryFilename = contextData.renamedXmlFilename
          } else if (renamePdf) {
            primaryFilename = contextData.renamedPdfFilename
          } else if (renameCsv) {
            primaryFilename = contextData.renamedCsvFilename
          } else if (renameJson) {
            primaryFilename = contextData.renamedJsonFilename
          } else if (renameXml) {
            primaryFilename = contextData.renamedXmlFilename
          }

          contextData.renamedFilename = primaryFilename
          contextData.actualFilename = primaryFilename

          console.log('✅ Primary renamed filename:', primaryFilename)
          stepOutputData = {
            renamedFilenames,
            primaryFilename,
            baseFilename
          }

        } else if (step.step_type === 'sftp_upload') {
          console.log('📤 === EXECUTING SFTP UPLOAD STEP ===')
          const config = step.config_json || {}
          console.log('🔧 SFTP upload config:', JSON.stringify(config, null, 2))

          console.log('📋 Fetching default SFTP configuration...')
          const sftpConfigResponse = await fetch(`${supabaseUrl}/rest/v1/sftp_config?limit=1`, {
            headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'Content-Type': 'application/json', 'apikey': supabaseServiceKey }
          })

          if (!sftpConfigResponse.ok) {
            throw new Error(`Failed to fetch SFTP configuration: ${sftpConfigResponse.status} ${sftpConfigResponse.statusText}`)
          }

          const sftpConfigs = await sftpConfigResponse.json()
          if (!sftpConfigs || sftpConfigs.length === 0) {
            throw new Error('No SFTP configuration found. Please configure SFTP settings in Settings.')
          }

          const sftpConfig = sftpConfigs[0]
          console.log('✅ SFTP configuration loaded:', sftpConfig.name || sftpConfig.host)

          let fileContent = ''
          let filename = contextData.renamedFilename || contextData.actualFilename || contextData.pdfFilename || 'document'

          if (config.uploadType === 'pdf') {
            console.log('📄 Uploading PDF file')

            // Use format-specific renamed filename if available
            if (contextData.renamedPdfFilename) {
              filename = contextData.renamedPdfFilename
              console.log('✅ Using renamed PDF filename:', filename)
            } else if (!filename.toLowerCase().endsWith('.pdf')) {
              filename = `${filename}.pdf`
            }

            if (!contextData.pdfBase64) {
              throw new Error('PDF base64 data not available')
            }

            fileContent = contextData.pdfBase64

          } else if (config.uploadType === 'json') {
            console.log('📄 Uploading JSON file')

            // Use format-specific renamed filename if available
            if (contextData.renamedJsonFilename) {
              filename = contextData.renamedJsonFilename
              console.log('✅ Using renamed JSON filename:', filename)
            } else if (!filename.toLowerCase().endsWith('.json')) {
              filename = filename.replace(/\.(pdf|json|xml|csv)$/i, '') + '.json'
            }

            const dataToUpload = contextData.extractedData || contextData
            fileContent = Buffer.from(JSON.stringify(dataToUpload, null, 2)).toString('base64')

          } else if (config.uploadType === 'xml') {
            console.log('📄 Uploading XML file')

            // Use format-specific renamed filename if available
            if (contextData.renamedXmlFilename) {
              filename = contextData.renamedXmlFilename
              console.log('✅ Using renamed XML filename:', filename)
            } else if (!filename.toLowerCase().endsWith('.xml')) {
              filename = filename.replace(/\.(pdf|json|xml|csv)$/i, '') + '.xml'
            }

            const dataToUpload = contextData.extractedData || contextData
            fileContent = Buffer.from(JSON.stringify(dataToUpload, null, 2)).toString('base64')

          } else if (config.uploadType === 'csv') {
            console.log('📄 Uploading CSV file')

            // Use format-specific renamed filename if available
            if (contextData.renamedCsvFilename) {
              filename = contextData.renamedCsvFilename
              console.log('✅ Using renamed CSV filename:', filename)
            } else if (!filename.toLowerCase().endsWith('.csv')) {
              filename = filename.replace(/\.(pdf|json|xml|csv)$/i, '') + '.csv'
            }

            let csvData: string | null = null

            if (contextData.extractedData && typeof contextData.extractedData === 'string') {
              console.log('✅ Found CSV data in extractedData (string)')
              csvData = contextData.extractedData
            } else if (contextData.originalExtractedData && typeof contextData.originalExtractedData === 'string') {
              console.log('✅ Found CSV data in originalExtractedData (string)')
              csvData = contextData.originalExtractedData
            } else {
              console.error('❌ CSV data not found')
              console.error('- extractedData type:', typeof contextData.extractedData)
              console.error('- originalExtractedData type:', typeof contextData.originalExtractedData)
              throw new Error('CSV data not available or not in string format')
            }

            fileContent = Buffer.from(csvData).toString('base64')
            console.log('✅ CSV data converted to base64, length:', fileContent.length)
          }

          console.log('📤 Calling SFTP upload function...')
          console.log('📄 Filename:', filename)
          console.log('📏 File content length:', fileContent.length)

          const uploadFileTypes: any = {}
          if (config.uploadType === 'pdf') {
            uploadFileTypes.pdf = true
          } else if (config.uploadType === 'json') {
            uploadFileTypes.json = true
          } else if (config.uploadType === 'xml') {
            uploadFileTypes.xml = true
          } else if (config.uploadType === 'csv') {
            uploadFileTypes.csv = true
          }

          // Determine if we should use an exact filename (from rename step)
          // Strip extension from the filename to pass as exactFilename
          let exactFilenameToPass: string | undefined = undefined

          if (config.uploadType === 'pdf' && contextData.renamedPdfFilename) {
            exactFilenameToPass = contextData.renamedPdfFilename.replace(/\.(pdf|csv|json|xml)$/i, '')
            console.log('📤 Passing exact filename for PDF:', exactFilenameToPass)
          } else if (config.uploadType === 'csv' && contextData.renamedCsvFilename) {
            exactFilenameToPass = contextData.renamedCsvFilename.replace(/\.(pdf|csv|json|xml)$/i, '')
            console.log('📤 Passing exact filename for CSV:', exactFilenameToPass)
          } else if (config.uploadType === 'json' && contextData.renamedJsonFilename) {
            exactFilenameToPass = contextData.renamedJsonFilename.replace(/\.(pdf|csv|json|xml)$/i, '')
            console.log('📤 Passing exact filename for JSON:', exactFilenameToPass)
          } else if (config.uploadType === 'xml' && contextData.renamedXmlFilename) {
            exactFilenameToPass = contextData.renamedXmlFilename.replace(/\.(pdf|csv|json|xml)$/i, '')
            console.log('📤 Passing exact filename for XML:', exactFilenameToPass)
          } else if (contextData.renamedFilename) {
            // Fallback to generic renamed filename
            exactFilenameToPass = contextData.renamedFilename.replace(/\.(pdf|csv|json|xml)$/i, '')
            console.log('📤 Passing exact filename (generic):', exactFilenameToPass)
          }

          const sftpUploadPayload: any = {
            sftpConfig: {
              host: sftpConfig.host,
              port: sftpConfig.port,
              username: sftpConfig.username,
              password: sftpConfig.password,
              xmlPath: sftpConfig.remote_path || '/ParseIt_XML',
              pdfPath: sftpConfig.pdf_path || '/ParseIt_PDF',
              jsonPath: sftpConfig.json_path || '/ParseIt_JSON',
              csvPath: sftpConfig.csv_path || '/ParseIt_CSV'
            },
            xmlContent: config.uploadType === 'csv' ? fileContent : (contextData.extractedData && typeof contextData.extractedData === 'object' ? JSON.stringify(contextData.extractedData) : '{}'),
            pdfBase64: contextData.pdfBase64 || '',
            baseFilename: filename,
            originalFilename: contextData.originalPdfFilename || filename,
            formatType: formatType,
            uploadFileTypes: uploadFileTypes
          }

          // Add exactFilename if we have a renamed filename
          if (exactFilenameToPass) {
            sftpUploadPayload.exactFilename = exactFilenameToPass
            console.log('📤 Adding exactFilename to payload:', exactFilenameToPass)
          }

          console.log('📤 SFTP upload payload:', JSON.stringify({
            ...sftpUploadPayload,
            pdfBase64: `[${sftpUploadPayload.pdfBase64.length} chars]`,
            xmlContent: `[${sftpUploadPayload.xmlContent.length} chars]`
          }, null, 2))

          const sftpUploadResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(sftpUploadPayload)
          })

          console.log('📤 SFTP upload response status:', sftpUploadResponse.status)

          if (!sftpUploadResponse.ok) {
            const errorText = await sftpUploadResponse.text()
            console.error('❌ SFTP upload failed:', errorText)
            throw new Error(`SFTP upload failed: ${errorText}`)
          }

          const uploadResult = await sftpUploadResponse.json()
          console.log('✅ SFTP upload successful:', uploadResult)

          stepOutputData = { uploadResult, filename }

        } else if (step.step_type === 'email_action') {
          console.log('📧 === EXECUTING EMAIL ACTION STEP ===')
          const config = step.config_json || {}
          console.log('🔧 Email config:', JSON.stringify(config, null, 2))

          let subject = config.subject || 'Workflow Notification'
          let body = config.body || ''

          const placeholderRegex = /\{\{([^}]+)\}\}/g
          let match

          while ((match = placeholderRegex.exec(subject)) !== null) {
            const placeholder = match[0]
            const path = match[1]
            const value = getValueByPath(contextData, path)
            if (value !== null && value !== undefined) {
              subject = subject.replace(placeholder, String(value))
            }
          }

          while ((match = placeholderRegex.exec(body)) !== null) {
            const placeholder = match[0]
            const path = match[1]
            const value = getValueByPath(contextData, path)
            if (value !== null && value !== undefined) {
              body = body.replace(placeholder, String(value))
            }
          }

          console.log('📧 Sending email...')
          console.log('📧 To:', config.to)
          console.log('📧 Subject:', subject)

          stepOutputData = {
            emailSent: true,
            to: config.to,
            subject,
            message: 'Email action executed (actual sending not implemented in this version)'
          }

        } else {
          console.log(`⚠️ Unknown step type: ${step.step_type}`)
          stepOutputData = { skipped: true, reason: 'Step type not implemented' }
        }

        const stepEndTime = new Date().toISOString()
        const stepDurationMs = Date.now() - stepStartMs

        console.log(`✅ Step ${step.step_order} completed successfully in ${stepDurationMs}ms`)

        if (workflowExecutionLogId) {
          await createStepLog(
            supabaseUrl,
            supabaseServiceKey,
            workflowExecutionLogId,
            requestData.workflowId,
            step,
            'completed',
            stepStartTime,
            stepEndTime,
            stepDurationMs,
            undefined,
            { config: step.config_json },
            stepOutputData
          )
        }

      } catch (stepError) {
        const stepEndTime = new Date().toISOString()
        const stepDurationMs = Date.now() - stepStartMs

        console.error(`❌ Step ${step.step_order} failed:`, stepError)

        if (workflowExecutionLogId) {
          await createStepLog(
            supabaseUrl,
            supabaseServiceKey,
            workflowExecutionLogId,
            requestData.workflowId,
            step,
            'failed',
            stepStartTime,
            stepEndTime,
            stepDurationMs,
            stepError.message,
            { config: step.config_json },
            null
          )

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

        const error: any = new Error(stepError.message)
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
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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
