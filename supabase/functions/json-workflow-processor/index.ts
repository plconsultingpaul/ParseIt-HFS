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
            formatType = typeDetails.format_type || 'JSON'
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
    console.log('📊 DEBUG - All steps loaded:')
    steps.forEach((step, index) => {
      console.log(`  [${index}] Step ${step.step_order}: ${step.step_name} (type: ${step.step_type}, id: ${step.id})`)
    })

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
    console.log('🔄 DEBUG - About to enter for loop from i=0 to i=' + (steps.length - 1))
    let lastApiResponse: any = null

    const getValueByPath = (obj: any, path: string, debugMode = false): any => {
      try {
        if (debugMode) {
          console.log(`🔍 [getValueByPath] Starting path resolution for: "${path}"`)
          console.log(`🔍 [getValueByPath] Input object keys:`, Object.keys(obj || {}))
        }

        const parts = path.split('.')
        let current = obj

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]
          if (debugMode) {
            console.log(`🔍 [getValueByPath] Step ${i + 1}/${parts.length}: Processing part "${part}"`)
            console.log(`🔍 [getValueByPath] Current object type:`, typeof current)
            if (typeof current === 'object' && current !== null) {
              console.log(`🔍 [getValueByPath] Current object keys:`, Object.keys(current))
            }
          }

          if (part.includes('[') && part.includes(']')) {
            const arrayName = part.substring(0, part.indexOf('['))
            const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
            if (debugMode) {
              console.log(`🔍 [getValueByPath] Array access: ${arrayName}[${arrayIndex}]`)
              console.log(`🔍 [getValueByPath] Array exists:`, current?.[arrayName] !== undefined)
              console.log(`🔍 [getValueByPath] Array length:`, current?.[arrayName]?.length)
            }
            current = current[arrayName]?.[arrayIndex]
            if (debugMode) {
              console.log(`🔍 [getValueByPath] After array access, current:`, current)
            }
          } else if (!isNaN(Number(part))) {
            const arrayIndex = parseInt(part)
            if (debugMode) {
              console.log(`🔍 [getValueByPath] Numeric index access: [${arrayIndex}]`)
            }
            current = current?.[arrayIndex]
            if (debugMode) {
              console.log(`🔍 [getValueByPath] After numeric access, current:`, current)
            }
          } else {
            if (debugMode) {
              console.log(`🔍 [getValueByPath] Property access: .${part}`)
              console.log(`🔍 [getValueByPath] Property exists:`, current?.[part] !== undefined)
            }
            current = current?.[part]
            if (debugMode) {
              console.log(`🔍 [getValueByPath] After property access, current:`, current)
            }
          }

          if (current === undefined || current === null) {
            if (debugMode) {
              console.log(`🔍 [getValueByPath] Path resolution stopped at part "${part}" - value is ${current === undefined ? 'undefined' : 'null'}`)
            }
            return null
          }
        }

        if (debugMode) {
          console.log(`🔍 [getValueByPath] ✅ Path resolution complete. Final value:`, current)
          console.log(`🔍 [getValueByPath] Final value type:`, typeof current)
        }
        return current
      } catch (error) {
        console.error(`❌ [getValueByPath] Error getting value by path "${path}":`, error)
        return null
      }
    }

    for (let i = 0; i < steps.length; i++) {
      console.log(`\n🔄 DEBUG - Loop iteration i=${i}, processing step at index ${i}`)
      const step = steps[i]
      console.log(`🔄 DEBUG - Retrieved step object: order=${step.step_order}, name=${step.step_name}, type=${step.step_type}`)

      const stepStartTime = new Date().toISOString()
      const stepStartMs = Date.now()

      console.log(`🔄 === EXECUTING STEP ${step.step_order}: ${step.step_name} ===`)
      console.log('🔧 Step type:', step.step_type)
      console.log('🔧 Step ID:', step.id)

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
        const config = step.config_json || {}
        let shouldSkipStep = false
        let skipReason = ''

        if (config.skipIf) {
          console.log('🔍 Checking skipIf condition:', config.skipIf)
          const conditionResult = getValueByPath(contextData, config.skipIf)
          console.log('🔍 skipIf condition result:', conditionResult)

          if (conditionResult === true) {
            shouldSkipStep = true
            skipReason = `skipIf condition met: ${config.skipIf} = true`
            console.log(`⏭️ Skipping step ${step.step_order} (${step.step_name}): ${skipReason}`)
          }
        }

        if (!shouldSkipStep && config.runIf) {
          console.log('🔍 Checking runIf condition:', config.runIf)
          const conditionResult = getValueByPath(contextData, config.runIf)
          console.log('🔍 runIf condition result:', conditionResult)

          if (conditionResult !== true) {
            shouldSkipStep = true
            skipReason = `runIf condition not met: ${config.runIf} = ${conditionResult}`
            console.log(`⏭️ Skipping step ${step.step_order} (${step.step_name}): ${skipReason}`)
          }
        }

        if (shouldSkipStep) {
          stepOutputData = {
            skipped: true,
            reason: skipReason,
            conditionalSkip: true
          }

          const stepEndTime = new Date().toISOString()
          const stepDurationMs = Date.now() - stepStartMs

          console.log(`⏭️ Step ${step.step_order} skipped due to conditional logic in ${stepDurationMs}ms`)

          if (workflowExecutionLogId) {
            await createStepLog(
              supabaseUrl,
              supabaseServiceKey,
              workflowExecutionLogId,
              requestData.workflowId,
              step,
              'skipped',
              stepStartTime,
              stepEndTime,
              stepDurationMs,
              skipReason,
              { config: step.config_json },
              stepOutputData
            )
          }

          console.log(`✅ DEBUG - Completed iteration i=${i} for step ${step.step_order}. Moving to next iteration.`)
          continue
        }

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
            console.log('🔄 === EXTRACTING DATA FROM API RESPONSE ===')
            console.log('🔍 DEBUG - responseDataPath:', JSON.stringify(config.responseDataPath))
            console.log('🔍 DEBUG - updateJsonPath:', JSON.stringify(config.updateJsonPath))
            console.log('🔍 DEBUG - Full API responseData:', JSON.stringify(responseData, null, 2))
            console.log('🔍 DEBUG - contextData BEFORE update:', JSON.stringify(contextData, null, 2))
            try {
              console.log('🔍 === STEP 1: EXTRACTING VALUE FROM API RESPONSE ===')
              let responseValue = getValueByPath(responseData, config.responseDataPath, true)

              console.log('✅ Extracted value from API response:', responseValue)
              console.log('📊 DEBUG - Extracted value type:', typeof responseValue)
              console.log('📊 DEBUG - Extracted value stringified:', JSON.stringify(responseValue))

              console.log('🔍 === STEP 2: STORING VALUE IN CONTEXT DATA ===')
              const updatePathParts = config.updateJsonPath.split('.')
              console.log('🔍 DEBUG - updatePathParts:', JSON.stringify(updatePathParts))
              console.log('🔍 DEBUG - Will navigate through', updatePathParts.length - 1, 'intermediate parts')
              let current = contextData

              for (let j = 0; j < updatePathParts.length - 1; j++) {
                const part = updatePathParts[j]
                console.log(`🔍 DEBUG - Processing intermediate part ${j + 1}/${updatePathParts.length - 1}: "${part}"`)

                if (part.includes('[') && part.includes(']')) {
                  const arrayName = part.substring(0, part.indexOf('['))
                  const arrayIndex = parseInt(part.substring(part.indexOf('[') + 1, part.indexOf(']')))
                  console.log(`🔍 DEBUG - Array navigation: ${arrayName}[${arrayIndex}]`)

                  if (!current[arrayName]) {
                    console.log(`🔍 DEBUG - Creating array: ${arrayName}`)
                    current[arrayName] = []
                  }

                  console.log(`🔍 DEBUG - Current array length: ${current[arrayName].length}, need index: ${arrayIndex}`)
                  while (current[arrayName].length <= arrayIndex) {
                    console.log(`🔍 DEBUG - Expanding array, adding object at index ${current[arrayName].length}`)
                    current[arrayName].push({})
                  }

                  current = current[arrayName][arrayIndex]
                  console.log(`🔍 DEBUG - Navigated to ${arrayName}[${arrayIndex}]:`, JSON.stringify(current))
                } else {
                  console.log(`🔍 DEBUG - Object navigation: .${part}`)
                  if (!current[part]) {
                    console.log(`🔍 DEBUG - Creating object property: ${part}`)
                    current[part] = {}
                  }
                  current = current[part]
                  console.log(`🔍 DEBUG - Navigated to .${part}:`, JSON.stringify(current))
                }
              }

              const finalPart = updatePathParts[updatePathParts.length - 1]
              console.log('🔍 === STEP 3: STORING VALUE AT FINAL LOCATION ===')
              console.log('🔍 DEBUG - Final part to store at:', finalPart)
              console.log('🔍 DEBUG - Current object before storage:', JSON.stringify(current))

              if (finalPart.includes('[') && finalPart.includes(']')) {
                const arrayName = finalPart.substring(0, finalPart.indexOf('['))
                const arrayIndex = parseInt(finalPart.substring(finalPart.indexOf('[') + 1, finalPart.indexOf(']')))
                console.log(`🔍 DEBUG - Storing in array: ${arrayName}[${arrayIndex}]`)

                if (!current[arrayName]) {
                  console.log(`🔍 DEBUG - Creating final array: ${arrayName}`)
                  current[arrayName] = []
                }

                while (current[arrayName].length <= arrayIndex) {
                  console.log(`🔍 DEBUG - Expanding final array, adding object at index ${current[arrayName].length}`)
                  current[arrayName].push({})
                }

                current[arrayName][arrayIndex] = responseValue
                console.log(`✅ Stored value at ${arrayName}[${arrayIndex}]:`, current[arrayName][arrayIndex])
              } else {
                current[finalPart] = responseValue
                console.log('✅ Stored value at final property "' + finalPart + '":', current[finalPart])
              }

              console.log('🔍 === STEP 4: VERIFICATION ===')
              console.log('✅ Updated context data with API response')
              console.log('🔍 DEBUG - Full contextData after update:', JSON.stringify(contextData, null, 2))
              console.log('🔍 DEBUG - contextData keys after update:', Object.keys(contextData))
              console.log('🔍 DEBUG - Verifying stored value by re-reading path:', config.updateJsonPath)
              const verificationValue = getValueByPath(contextData, config.updateJsonPath, true)
              console.log('🔍 DEBUG - Verification read result:', verificationValue)
              if (verificationValue === responseValue) {
                console.log('✅✅✅ VERIFICATION PASSED: Value successfully stored and retrieved!')
              } else {
                console.log('❌❌❌ VERIFICATION FAILED: Retrieved value does not match stored value!')
                console.log('Expected:', responseValue)
                console.log('Got:', verificationValue)
              }
            } catch (extractError) {
              console.error('❌ Failed to extract data from API response:', extractError)
              console.error('❌ DEBUG - Full error:', extractError)
            }
          } else {
            console.log('⚠️ DEBUG - Skipping data extraction:')
            console.log('  - responseDataPath present:', !!config.responseDataPath)
            console.log('  - updateJsonPath present:', !!config.updateJsonPath)
            console.log('  - responseDataPath value:', config.responseDataPath)
            console.log('  - updateJsonPath value:', config.updateJsonPath)
          }

        } else if (step.step_type === 'rename_file' || step.step_type === 'rename_pdf') {
          console.log('📝 === EXECUTING RENAME FILE STEP ===')
          const config = step.config_json || {}
          console.log('🔧 Rename config:', JSON.stringify(config, null, 2))

          console.log('🔍 DEBUG - contextData keys at start of rename:', Object.keys(contextData))
          console.log('🔍 DEBUG - contextData.billNumber:', contextData.billNumber)
          console.log('🔍 DEBUG - lastApiResponse:', lastApiResponse)

          let template = config.filenameTemplate || config.template || 'Remit_{{pdfFilename}}'
          console.log('📄 Original template:', template)

          const placeholderRegex = /\{\{([^}]+)\}\}/g
          let match

          while ((match = placeholderRegex.exec(template)) !== null) {
            const placeholder = match[0]
            const path = match[1]
            let value = getValueByPath(contextData, path)

            console.log(`🔍 Replacing ${placeholder} (path: "${path}")`)
            console.log(`🔍   - Value from contextData:`, value)

            if ((value === null || value === undefined) && lastApiResponse) {
              value = getValueByPath(lastApiResponse, path)
              console.log(`🔍   - Fallback value from lastApiResponse:`, value)
            }

            if (value !== null && value !== undefined) {
              template = template.replace(placeholder, String(value))
              console.log(`🔍   - Replaced with:`, String(value))
            } else {
              console.log(`⚠️   - No value found for ${placeholder}`)
            }
          }

          console.log('📄 Template after replacements:', template)

          let baseFilename = template.replace(/\.(pdf|csv|json|xml)$/i, '')
          console.log('📄 Base filename (without extension):', baseFilename)

          const appendTimestamp = config.appendTimestamp === true
          const timestampFormat = config.timestampFormat || 'YYYYMMDD'

          console.log('⏰ Append timestamp:', appendTimestamp)
          if (appendTimestamp) {
            console.log('⏰ Timestamp format:', timestampFormat)
          }

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

          const renamePdf = config.renamePdf === true
          const renameCsv = config.renameCsv === true
          const renameJson = config.renameJson === true
          const renameXml = config.renameXml === true

          console.log('📋 File types to rename:', { renamePdf, renameCsv, renameJson, renameXml })

          const renamedFilenames: any = {}

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

            if (contextData.renamedXmlFilename) {
              filename = contextData.renamedXmlFilename
              console.log('✅ Using renamed XML filename:', filename)
            } else if (!filename.toLowerCase().endsWith('.xml')) {
              filename = filename.replace(/\.(pdf|json|xml|csv)$/i, '') + '.xml'
            }

            const dataToUpload = contextData.extractedData || contextData
            fileContent = Buffer.from(JSON.stringify(dataToUpload, null, 2)).toString('base64')

          } else if (config.uploadType === 'csv') {
            console.log('�� === UPLOADING CSV FILE ===')

            if (contextData.renamedCsvFilename) {
              filename = contextData.renamedCsvFilename
              console.log('✅ Using renamed CSV filename:', filename)
            } else if (!filename.toLowerCase().endsWith('.csv')) {
              filename = filename.replace(/\.(pdf|json|xml|csv)$/i, '') + '.csv'
            }

            console.log('📊 Searching for CSV data in contextData...')
            console.log('📊 contextData.extractedData type:', typeof contextData.extractedData)
            console.log('📊 contextData.originalExtractedData type:', typeof contextData.originalExtractedData)

            let csvData: string | null = null

            if (contextData.extractedData && typeof contextData.extractedData === 'string') {
              console.log('✅ Found CSV data in extractedData (string)')
              csvData = contextData.extractedData
              console.log('📊 CSV data length:', csvData.length)
              console.log('📊 CSV data preview (first 200 chars):', csvData.substring(0, 200))
              console.log('📊 CSV data preview (last 100 chars):', csvData.substring(Math.max(0, csvData.length - 100)))
            } else if (contextData.originalExtractedData && typeof contextData.originalExtractedData === 'string') {
              console.log('✅ Found CSV data in originalExtractedData (string)')
              csvData = contextData.originalExtractedData
              console.log('📊 CSV data length:', csvData.length)
              console.log('📊 CSV data preview (first 200 chars):', csvData.substring(0, 200))
              console.log('📊 CSV data preview (last 100 chars):', csvData.substring(Math.max(0, csvData.length - 100)))
            } else {
              console.error('❌ CSV data not found')
              console.error('- extractedData type:', typeof contextData.extractedData)
              console.error('- originalExtractedData type:', typeof contextData.originalExtractedData)
              console.error('- extractedData value:', contextData.extractedData)
              console.error('- originalExtractedData value:', contextData.originalExtractedData)
              throw new Error('CSV data not available or not in string format')
            }

            fileContent = csvData
            console.log('✅ CSV data prepared for upload, length:', fileContent.length)
            console.log('✅ CSV fileContent preview (first 200 chars):', fileContent.substring(0, 200))
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
            exactFilenameToPass = contextData.renamedFilename.replace(/\.(pdf|csv|json|xml)$/i, '')
            console.log('📤 Passing exact filename (generic):', exactFilenameToPass)
          }

          console.log('🔍 === PREPARING CONTENT FOR SFTP ===')
          console.log('🔍 config.uploadType:', config.uploadType)
          console.log('🔍 fileContent type:', typeof fileContent)
          console.log('🔍 fileContent length:', fileContent ? fileContent.length : 0)
          console.log('🔍 formatType:', formatType)

          let contentForSftp: string
          if (config.uploadType === 'csv') {
            console.log('✅ Detected CSV upload type')
            contentForSftp = fileContent
            console.log('📤 === PREPARING CSV FOR SFTP ===')
            console.log('📤 contentForSftp type:', typeof contentForSftp)
            console.log('📤 contentForSftp length:', contentForSftp.length)
            console.log('📤 contentForSftp preview (first 300 chars):', contentForSftp.substring(0, 300))
            console.log('📤 contentForSftp preview (last 200 chars):', contentForSftp.substring(Math.max(0, contentForSftp.length - 200)))

            if (!contentForSftp || contentForSftp.trim() === '') {
              console.error('❌ CRITICAL: contentForSftp is empty!')
              console.error('❌ fileContent was:', fileContent)
              throw new Error('CSV content is empty before SFTP upload')
            }
          } else if (contextData.extractedData && typeof contextData.extractedData === 'object') {
            console.log('✅ Detected object type, converting to JSON')
            contentForSftp = JSON.stringify(contextData.extractedData)
          } else {
            console.log('⚠️ No valid content found, using empty object')
            contentForSftp = '{}'
          }

          console.log('🔍 === FINAL contentForSftp CHECK ===')
          console.log('🔍 contentForSftp type:', typeof contentForSftp)
          console.log('🔍 contentForSftp length:', contentForSftp ? contentForSftp.length : 0)
          console.log('🔍 contentForSftp is empty?:', !contentForSftp || contentForSftp.trim() === '')

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
            xmlContent: contentForSftp,
            pdfBase64: contextData.pdfBase64 || '',
            baseFilename: filename,
            originalFilename: contextData.originalPdfFilename || filename,
            formatType: formatType,
            uploadFileTypes: uploadFileTypes
          }

          if (exactFilenameToPass) {
            sftpUploadPayload.exactFilename = exactFilenameToPass
            console.log('📤 Adding exactFilename to payload:', exactFilenameToPass)
          }

          if (config.sftpPathOverride) {
            sftpUploadPayload.sftpPathOverride = config.sftpPathOverride
            console.log('📤 Adding sftpPathOverride to payload:', config.sftpPathOverride)
          }

          console.log('📤 === SFTP UPLOAD PAYLOAD DEBUG ===')
          console.log('📤 Payload xmlContent type:', typeof sftpUploadPayload.xmlContent)
          console.log('📤 Payload xmlContent length:', sftpUploadPayload.xmlContent ? sftpUploadPayload.xmlContent.length : 0)
          console.log('📤 Payload xmlContent preview (first 300):', sftpUploadPayload.xmlContent ? sftpUploadPayload.xmlContent.substring(0, 300) : 'EMPTY')
          console.log('📤 Payload xmlContent preview (last 200):', sftpUploadPayload.xmlContent ? sftpUploadPayload.xmlContent.substring(Math.max(0, sftpUploadPayload.xmlContent.length - 200)) : 'EMPTY')
          console.log('📤 SFTP upload payload structure:', JSON.stringify({
            ...sftpUploadPayload,
            pdfBase64: `[${sftpUploadPayload.pdfBase64.length} chars]`,
            xmlContent: `[${sftpUploadPayload.xmlContent ? sftpUploadPayload.xmlContent.length : 0} chars]`
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

        } else if (step.step_type === 'conditional_check') {
          console.log('🔍 === EXECUTING CONDITIONAL CHECK STEP ===')
          const config = step.config_json || {}
          console.log('🔧 Conditional check config:', JSON.stringify(config, null, 2))

          console.log('🔍 === STEP INPUT DATA INSPECTION ===')
          console.log('🔍 Full contextData at start of conditional check:', JSON.stringify(contextData, null, 2))
          console.log('🔍 contextData keys:', Object.keys(contextData))
          console.log('🔍 contextData.orders:', contextData.orders)
          if (contextData.orders && Array.isArray(contextData.orders)) {
            console.log('🔍 contextData.orders.length:', contextData.orders.length)
            console.log('🔍 contextData.orders[0]:', JSON.stringify(contextData.orders[0], null, 2))
            if (contextData.orders[0]?.consignee) {
              console.log('🔍 contextData.orders[0].consignee:', JSON.stringify(contextData.orders[0].consignee, null, 2))
              console.log('🔍 contextData.orders[0].consignee.clientId:', contextData.orders[0].consignee.clientId)
            } else {
              console.log('⚠️ contextData.orders[0].consignee is undefined')
            }
          } else {
            console.log('⚠️ contextData.orders is not an array or is undefined')
          }

          const fieldPath = config.fieldPath || config.jsonPath || config.checkField || ''
          const operator = config.operator || config.conditionType || 'exists'
          const expectedValue = config.expectedValue
          const storeResultAs = config.storeResultAs || `condition_${step.step_order}_result`

          console.log('🔍 === CONDITIONAL CHECK PARAMETERS ===')
          console.log('🔍 Checking field path:', fieldPath)
          console.log('🔍 Operator:', operator)
          console.log('🔍 Expected value:', expectedValue)

          console.log('🔍 === RETRIEVING ACTUAL VALUE ===')
          const actualValue = getValueByPath(contextData, fieldPath, true)
          console.log('✅ Actual value from context:', actualValue)
          console.log('📊 Actual value type:', typeof actualValue)
          console.log('📊 Actual value === null:', actualValue === null)
          console.log('📊 Actual value === undefined:', actualValue === undefined)
          console.log('📊 Actual value stringified:', JSON.stringify(actualValue))

          let conditionMet = false

          switch (operator) {
            case 'exists':
              conditionMet = actualValue !== null && actualValue !== undefined && actualValue !== ''
              console.log(`🔍 Condition (exists): ${conditionMet}`)
              break

            case 'is_not_null':
            case 'isNotNull':
              conditionMet = actualValue !== null && actualValue !== undefined
              console.log(`🔍 Condition (is_not_null): ${conditionMet}`)
              break

            case 'is_null':
            case 'isNull':
              conditionMet = actualValue === null || actualValue === undefined
              console.log(`🔍 Condition (is_null): ${conditionMet}`)
              break

            case 'not_exists':
            case 'notExists':
              conditionMet = actualValue === null || actualValue === undefined || actualValue === ''
              console.log(`🔍 Condition (not_exists): ${conditionMet}`)
              break

            case 'equals':
            case 'eq':
              conditionMet = String(actualValue) === String(expectedValue)
              console.log(`🔍 Condition (equals): "${actualValue}" === "${expectedValue}" = ${conditionMet}`)
              break

            case 'not_equals':
            case 'notEquals':
            case 'ne':
              conditionMet = String(actualValue) !== String(expectedValue)
              console.log(`🔍 Condition (not_equals): "${actualValue}" !== "${expectedValue}" = ${conditionMet}`)
              break

            case 'contains':
              conditionMet = String(actualValue).includes(String(expectedValue))
              console.log(`🔍 Condition (contains): "${actualValue}".includes("${expectedValue}") = ${conditionMet}`)
              break

            case 'not_contains':
            case 'notContains':
              conditionMet = !String(actualValue).includes(String(expectedValue))
              console.log(`🔍 Condition (not_contains): !("${actualValue}".includes("${expectedValue}")) = ${conditionMet}`)
              break

            case 'greater_than':
            case 'gt':
              const gtActual = parseFloat(actualValue)
              const gtExpected = parseFloat(expectedValue)
              conditionMet = !isNaN(gtActual) && !isNaN(gtExpected) && gtActual > gtExpected
              console.log(`🔍 Condition (greater_than): ${gtActual} > ${gtExpected} = ${conditionMet}`)
              break

            case 'less_than':
            case 'lt':
              const ltActual = parseFloat(actualValue)
              const ltExpected = parseFloat(expectedValue)
              conditionMet = !isNaN(ltActual) && !isNaN(ltExpected) && ltActual < ltExpected
              console.log(`🔍 Condition (less_than): ${ltActual} < ${ltExpected} = ${conditionMet}`)
              break

            case 'greater_than_or_equal':
            case 'gte':
              const gteActual = parseFloat(actualValue)
              const gteExpected = parseFloat(expectedValue)
              conditionMet = !isNaN(gteActual) && !isNaN(gteExpected) && gteActual >= gteExpected
              console.log(`🔍 Condition (greater_than_or_equal): ${gteActual} >= ${gteExpected} = ${conditionMet}`)
              break

            case 'less_than_or_equal':
            case 'lte':
              const lteActual = parseFloat(actualValue)
              const lteExpected = parseFloat(expectedValue)
              conditionMet = !isNaN(lteActual) && !isNaN(lteExpected) && lteActual <= lteExpected
              console.log(`🔍 Condition (less_than_or_equal): ${lteActual} <= ${lteExpected} = ${conditionMet}`)
              break

            default:
              console.warn(`⚠️ Unknown operator: ${operator}, defaulting to 'exists'`)
              conditionMet = actualValue !== null && actualValue !== undefined && actualValue !== ''
          }

          contextData[storeResultAs] = conditionMet
          console.log(`✅ Conditional check result stored as "${storeResultAs}": ${conditionMet}`)

          console.log('🔍 === ROUTING DECISION LOGIC ===')
          console.log('🔍 next_step_on_success_id:', step.next_step_on_success_id)
          console.log('🔍 next_step_on_failure_id:', step.next_step_on_failure_id)

          let nextStepOnSuccessName = 'Not configured'
          let nextStepOnSuccessOrder = null
          let nextStepOnFailureName = 'Not configured'
          let nextStepOnFailureOrder = null
          let selectedNextStepName = 'Sequential (next in order)'
          let selectedNextStepOrder = step.step_order + 1

          if (step.next_step_on_success_id) {
            const successStep = steps.find(s => s.id === step.next_step_on_success_id)
            if (successStep) {
              nextStepOnSuccessName = `${successStep.step_name} (Step ${successStep.step_order})`
              nextStepOnSuccessOrder = successStep.step_order
              console.log(`✅ Found success step: ${nextStepOnSuccessName}`)
            } else {
              console.log(`⚠️ Success step ID configured but step not found: ${step.next_step_on_success_id}`)
            }
          }

          if (step.next_step_on_failure_id) {
            const failureStep = steps.find(s => s.id === step.next_step_on_failure_id)
            if (failureStep) {
              nextStepOnFailureName = `${failureStep.step_name} (Step ${failureStep.step_order})`
              nextStepOnFailureOrder = failureStep.step_order
              console.log(`✅ Found failure step: ${nextStepOnFailureName}`)
            } else {
              console.log(`⚠️ Failure step ID configured but step not found: ${step.next_step_on_failure_id}`)
            }
          }

          if (conditionMet) {
            if (step.next_step_on_success_id) {
              selectedNextStepName = nextStepOnSuccessName
              selectedNextStepOrder = nextStepOnSuccessOrder
            }
          } else {
            if (step.next_step_on_failure_id) {
              selectedNextStepName = nextStepOnFailureName
              selectedNextStepOrder = nextStepOnFailureOrder
            }
          }

          const routingDecision = conditionMet
            ? `✅ CONDITION MET (${operator} = TRUE) → Should route to: ${selectedNextStepName}`
            : `❌ CONDITION NOT MET (${operator} = FALSE) → Should route to: ${selectedNextStepName}`

          console.log('🔍 === ROUTING DECISION ===')
          console.log(routingDecision)
          console.log('🔍 Next Step on Success:', nextStepOnSuccessName)
          console.log('🔍 Next Step on Failure:', nextStepOnFailureName)
          console.log('🔍 Selected Next Step:', selectedNextStepName)

          stepOutputData = {
            conditionMet,
            fieldPath,
            operator,
            actualValue,
            expectedValue,
            storeResultAs,
            nextStepOnSuccess: nextStepOnSuccessName,
            nextStepOnSuccessOrder: nextStepOnSuccessOrder,
            nextStepOnFailure: nextStepOnFailureName,
            nextStepOnFailureOrder: nextStepOnFailureOrder,
            selectedNextStep: selectedNextStepName,
            selectedNextStepOrder: selectedNextStepOrder,
            routingDecision: routingDecision
          }

          if (selectedNextStepOrder && selectedNextStepOrder !== step.step_order + 1) {
            console.log(`🔀 CONDITIONAL ROUTING: Jumping from Step ${step.step_order} to Step ${selectedNextStepOrder}`)

            const targetStepIndex = steps.findIndex(s => s.step_order === selectedNextStepOrder)
            if (targetStepIndex !== -1) {
              console.log(`✅ Target step found at index ${targetStepIndex}, adjusting loop counter`)
              i = targetStepIndex - 1
            } else {
              console.log(`❌ Target step ${selectedNextStepOrder} not found, continuing sequentially`)
            }
          }

        } else {
          console.log(`⚠️ Unknown step type: ${step.step_type}`)
          stepOutputData = { skipped: true, reason: 'Step type not implemented' }
        }

        const stepEndTime = new Date().toISOString()
        const stepDurationMs = Date.now() - stepStartMs

        console.log(`✅ === STEP ${step.step_order} COMPLETED SUCCESSFULLY IN ${stepDurationMs}ms ===`)
        console.log('📊 === FINAL CONTEXT DATA SNAPSHOT ===')
        console.log('📊 contextData keys:', Object.keys(contextData))
        console.log('📊 Full contextData:', JSON.stringify(contextData, null, 2))
        if (step.step_type === 'api_call') {
          console.log('📊 Last API response:', JSON.stringify(lastApiResponse, null, 2))
        }
        console.log('📊 === END CONTEXT DATA SNAPSHOT ===')

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
        console.log(`🚫 DEBUG - Step ${step.step_order} failed, throwing error and stopping workflow`)
        throw error
      }

      console.log(`✅ DEBUG - Completed iteration i=${i} for step ${step.step_order}. Moving to next iteration.`)
    }

    console.log(`✅ DEBUG - Exited for loop. Total iterations should have been: ${steps.length}`)
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