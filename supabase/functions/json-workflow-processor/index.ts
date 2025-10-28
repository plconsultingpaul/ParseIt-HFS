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
      step_order: step.step_order,
      step_name: step.step_name,
      step_type: step.step_type,
      status,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: durationMs,
      error_message: errorMessage,
      input_data: inputData,
      output_data: outputData
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/workflow_step_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(stepLogPayload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Failed to create step log:', errorText)
      throw new Error(`Failed to create step log: ${errorText}`)
    }

    const data = await response.json()
    const createdStepLogId = Array.isArray(data) && data.length > 0 ? data[0].id : data.id

    console.log(`✅ Step log created for step ${step.step_order}: ${createdStepLogId}`)
    return createdStepLogId
  } catch (error) {
    console.error('❌ Error creating step log:', error)
    throw error
  }
}

function getValueByPath(obj: any, path: string): any {
  console.log(`🔍 [getValueByPath] Starting path resolution for: "${path}"`)
  console.log(`🔍 [getValueByPath] Input object keys:`, Object.keys(obj || {}))

  if (!obj || !path) {
    console.log(`🔍 [getValueByPath] ⚠️ Invalid input - obj or path is missing`)
    return undefined
  }

  const parts = path.split('.')
  console.log(`🔍 [getValueByPath] Split path into ${parts.length} parts:`, parts)

  let current = obj

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    console.log(`🔍 [getValueByPath] Step ${i + 1}/${parts.length}: Processing part "${part}"`)
    console.log(`🔍 [getValueByPath] Current object type:`, typeof current)
    console.log(`🔍 [getValueByPath] Current object keys:`, Object.keys(current || {}))

    const arrayMatch = part.match(/^(.+?)\[(\d+)\]$/)

    if (arrayMatch) {
      const arrayName = arrayMatch[1]
      const index = parseInt(arrayMatch[2], 10)
      console.log(`🔍 [getValueByPath] Numeric index access: [${index}]`)

      if (current[arrayName] !== undefined) {
        current = current[arrayName]
        console.log(`🔍 [getValueByPath] After property access, current:`, current)

        if (Array.isArray(current) && index >= 0 && index < current.length) {
          current = current[index]
          console.log(`🔍 [getValueByPath] After numeric access, current:`, current)
        } else {
          console.log(`🔍 [getValueByPath] ❌ Array index ${index} out of bounds or not an array`)
          return undefined
        }
      } else {
        console.log(`🔍 [getValueByPath] ❌ Property "${arrayName}" not found`)
        return undefined
      }
    } else {
      console.log(`🔍 [getValueByPath] Property access: .${part}`)
      console.log(`🔍 [getValueByPath] Property exists:`, current.hasOwnProperty(part))

      if (current[part] !== undefined) {
        current = current[part]
        console.log(`🔍 [getValueByPath] After property access, current:`, current)
      } else {
        console.log(`🔍 [getValueByPath] ❌ Property "${part}" not found`)
        return undefined
      }
    }
  }

  console.log(`🔍 [getValueByPath] Final value type:`, typeof current)
  console.log(`🔍 [getValueByPath] ✅ Path resolution complete. Final value:`, current)

  return current
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const requestData: WorkflowExecutionRequest = await req.json()
    const { extractedData, workflowId, pdfFilename, pdfPages, originalPdfFilename, pdfBase64, pdfStoragePath } = requestData

    console.log('📥 Received workflow execution request:', {
      workflowId,
      pdfFilename,
      pdfPages,
      hasExtractedData: !!extractedData,
      hasPdfBase64: !!pdfBase64,
      pdfStoragePath
    })

    let parsedData: any = {}
    try {
      parsedData = extractedData ? JSON.parse(extractedData) : {}
      console.log('✅ Successfully parsed extracted data')
    } catch (e) {
      console.error('❌ Failed to parse extracted data:', e)
      throw new Error('Invalid extracted data format')
    }

    const workflowExecutionLogStartTime = new Date().toISOString()

    const executionLogPayload = {
      workflow_id: workflowId,
      status: 'running',
      started_at: workflowExecutionLogStartTime,
      input_data: requestData
    }

    console.log('📝 Creating workflow execution log...')
    const executionLogResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(executionLogPayload)
    })

    if (!executionLogResponse.ok) {
      const errorText = await executionLogResponse.text()
      throw new Error(`Failed to create execution log: ${errorText}`)
    }

    const executionLogData = await executionLogResponse.json()
    const workflowExecutionLogId = Array.isArray(executionLogData) && executionLogData.length > 0 
      ? executionLogData[0].id 
      : executionLogData.id

    console.log('✅ Workflow execution log created:', workflowExecutionLogId)

    console.log('🔍 Fetching workflow steps...')
    const stepsResponse = await fetch(
      `${supabaseUrl}/rest/v1/workflow_steps?workflow_id=eq.${workflowId}&order=step_order.asc`,
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      }
    )

    if (!stepsResponse.ok) {
      throw new Error('Failed to fetch workflow steps')
    }

    const steps: WorkflowStep[] = await stepsResponse.json()
    console.log(`✅ Found ${steps.length} workflow steps`)

    const contextData: any = {
      extractedData: parsedData,
      originalExtractedData: extractedData || '{}',
      formatType: 'JSON',
      pdfFilename,
      originalPdfFilename,
      pdfStoragePath,
      pdfBase64
    }

    if (parsedData.orders && Array.isArray(parsedData.orders)) {
      contextData.orders = parsedData.orders
      console.log('✅ Stored orders array in context')
    }

    console.log('🚀 === BEGINNING WORKFLOW EXECUTION ===')
    console.log(`📊 Total steps to execute: ${steps.length}`)

    for (let i = 0; i < steps.length; i++) {
      console.log(`\n🔄 DEBUG - Loop iteration i=${i}, processing step at index ${i}`)
      const step = steps[i]

      console.log(`🔄 === EXECUTING STEP ${step.step_order}: ${step.step_name} ===`)
      console.log(`🔧 Step ID: ${step.id}`)
      console.log(`🔧 Step type: ${step.step_type}`)
      console.log(`🔄 DEBUG - Retrieved step object: order=${step.step_order}, name=${step.step_name}, type=${step.step_type}`)

      const stepStartTime = new Date().toISOString()
      const stepStartTimestamp = Date.now()

      try {
        const config = step.config_json

        if (step.step_type === 'condition') {
          console.log('🔀 Executing condition step')

          const leftValuePath = config.leftValuePath || ''
          const operator = config.operator || '=='
          const rightValue = config.rightValue || ''

          console.log(`📊 Condition config:`, { leftValuePath, operator, rightValue })

          const leftValue = getValueByPath(contextData, leftValuePath)

          console.log(`🔍 Left value from path "${leftValuePath}":`, leftValue)
          console.log(`🔍 Operator: ${operator}`)
          console.log(`🔍 Right value: ${rightValue}`)

          let conditionResult = false

          switch (operator) {
            case '==':
              conditionResult = String(leftValue) === String(rightValue)
              break
            case '!=':
              conditionResult = String(leftValue) !== String(rightValue)
              break
            case '>':
              conditionResult = Number(leftValue) > Number(rightValue)
              break
            case '<':
              conditionResult = Number(leftValue) < Number(rightValue)
              break
            case '>=':
              conditionResult = Number(leftValue) >= Number(rightValue)
              break
            case '<=':
              conditionResult = Number(leftValue) <= Number(rightValue)
              break
            case 'contains':
              conditionResult = String(leftValue).includes(String(rightValue))
              break
            case 'not_contains':
              conditionResult = !String(leftValue).includes(String(rightValue))
              break
            case 'is_empty':
              conditionResult = !leftValue || String(leftValue).trim() === ''
              break
            case 'is_not_empty':
              conditionResult = !!leftValue && String(leftValue).trim() !== ''
              break
            default:
              console.error(`❌ Unknown operator: ${operator}`)
              conditionResult = false
          }

          console.log(`✅ Condition result: ${conditionResult}`)

          contextData[`condition_${step.step_order}_result`] = conditionResult

          const stepEndTime = new Date().toISOString()
          const durationMs = Date.now() - stepStartTimestamp

          await createStepLog(
            supabaseUrl,
            supabaseServiceKey,
            workflowExecutionLogId,
            workflowId,
            step,
            'completed',
            stepStartTime,
            stepEndTime,
            durationMs,
            undefined,
            { leftValuePath, operator, rightValue, leftValue },
            { result: conditionResult }
          )

          console.log(`✅ === STEP ${step.step_order} COMPLETED SUCCESSFULLY IN ${durationMs}ms ===`)

        } else if (step.step_type === 'api_call') {
          console.log('🌐 Executing API call step')

          let url = config.url || ''
          console.log('🔗 Original URL:', url)

          const urlPlaceholderRegex = /\{\{([^}]+)\}\}/g
          let urlMatch
          const urlReplacements: { placeholder: string, path: string, value: any }[] = []

          while ((urlMatch = urlPlaceholderRegex.exec(url)) !== null) {
            const placeholder = urlMatch[0]
            const path = urlMatch[1]

            console.log(`🔍 Found URL placeholder: ${placeholder} with path: ${path}`)

            const value = getValueByPath(contextData, path)
            urlReplacements.push({ placeholder, path, value })

            console.log(`🔍 Path "${path}" resolved to:`, value)
          }

          for (const replacement of urlReplacements) {
            const rawValue = String(replacement.value || '')
            const encodedValue = encodeURIComponent(rawValue)
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

          try {
            if (step.step_order === 400 || step.step_name.includes('Send Updated JSON')) {
              console.log('DIAGNOSTIC: BEFORE STEP 400 EXECUTION')
              console.log('DIAGNOSTIC: Step Order:', step.step_order)
              console.log('DIAGNOSTIC: Step Name:', step.step_name)

              const clientIdFromOrders = getValueByPath(contextData, 'orders[0].consignee.clientId')
              const clientIdFromExtracted = getValueByPath(contextData, 'extractedData.orders[0].consignee.clientId')

              console.log('DIAGNOSTIC: contextData.orders[0]?.consignee?.clientId:', clientIdFromOrders)
              console.log('DIAGNOSTIC: contextData.extractedData?.orders?.[0]?.consignee?.clientId:', clientIdFromExtracted)

              if (contextData.extractedData && contextData.orders) {
                const refCheck = contextData.extractedData.orders === contextData.orders
                console.log('DIAGNOSTIC: Reference Check:', refCheck ? 'SAME' : 'DIFFERENT')
              }

              const requestBodyTemplate = config.requestBody || ''
              console.log('DIAGNOSTIC: Request body contains {{extractedData}}:', requestBodyTemplate.includes('{{extractedData}}'))
            }
          } catch (e) {
            console.error('DIAGNOSTIC ERROR: Before Step 400', e)
          }

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

            if (contextData.extractedData && typeof contextData.extractedData === 'object') {
              const stringifiedData = JSON.stringify(contextData.extractedData)
              requestBody = requestBody.replace(/\{\{extractedData\}\}/g, stringifiedData)
              console.log('✅ Replaced {{extractedData}} with stringified extracted data object (LIVE DATA)')

              try {
                const clientId = contextData.extractedData?.orders?.[0]?.consignee?.clientId
                console.log('🔍 DIAGNOSTIC: clientId in live extractedData:', clientId || 'NOT FOUND')
              } catch (e) {
                console.log('🔍 DIAGNOSTIC: Could not extract clientId for verification')
              }
            } else if (contextData.originalExtractedData && typeof contextData.originalExtractedData === 'string') {
              requestBody = requestBody.replace(/\{\{extractedData\}\}/g, contextData.originalExtractedData)
              console.log('⚠️ Replaced {{extractedData}} with original extracted data string (FALLBACK - may not include updates)')
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

          try {
            if (step.step_order === 400 || step.step_name.includes('Send Updated JSON')) {
              console.log('DIAGNOSTIC: AFTER PLACEHOLDER REPLACEMENT')
              console.log('DIAGNOSTIC: Request body (first 1000 chars):', requestBody.substring(0, 1000))

              try {
                const parsedBody = JSON.parse(requestBody)
                const clientIdInBody = parsedBody?.orders?.[0]?.consignee?.clientId

                if (clientIdInBody) {
                  console.log('DIAGNOSTIC: SUCCESS - clientId in request body:', clientIdInBody)
                } else {
                  console.log('DIAGNOSTIC: FAILURE - clientId NOT in request body')
                  console.log('DIAGNOSTIC: parsedBody.orders?.[0]?.consignee:', parsedBody?.orders?.[0]?.consignee)
                }
              } catch (parseError) {
                console.log('DIAGNOSTIC: Could not parse request body as JSON (might be XML or other format)')
              }
            }
          } catch (e) {
            console.error('DIAGNOSTIC ERROR: After Placeholder Replacement', e)
          }

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
          console.log('📥 API response text length:', responseText.length)

          let responseData: any = {}
          try {
            if (responseText && responseText.trim() !== '') {
              responseData = JSON.parse(responseText)
              console.log('✅ Successfully parsed API response as JSON')
            } else {
              console.log('⚠️ Empty API response')
              responseData = { success: true, message: 'Empty response' }
            }
          } catch (e) {
            console.log('⚠️ Response is not JSON, storing as text')
            responseData = { raw: responseText }
          }

          console.log('🔍 DEBUG - lastApiResponse:', responseData)
          contextData.lastApiResponse = responseData

          if (config.updateJsonPath && config.responseDataPath) {
            console.log('🔍 === STEP 1: EXTRACTING VALUE FROM API RESPONSE ===')
            console.log('🔍 DEBUG - responseDataPath:', config.responseDataPath)
            console.log('🔍 DEBUG - updateJsonPath:', config.updateJsonPath)

            const extractedValue = getValueByPath(responseData, config.responseDataPath)

            console.log('✅ Extracted value from API response:', extractedValue)
            console.log('📊 DEBUG - Extracted value stringified:', JSON.stringify(extractedValue))
            console.log('📊 DEBUG - Extracted value type:', typeof extractedValue)

            console.log('🔍 === STEP 2: STORING VALUE IN CONTEXT DATA ===')
            console.log('🔍 DEBUG - updatePathParts:', [config.updateJsonPath])
            console.log('🔍 DEBUG - Will navigate through 0 intermediate parts')
            console.log('🔍 DEBUG - Final part to store at:', config.updateJsonPath)

            console.log('🔍 === STEP 3: STORING VALUE AT FINAL LOCATION ===')
            console.log('🔍 DEBUG - Current object before storage:', JSON.stringify(contextData))

            contextData[config.updateJsonPath] = extractedValue

            console.log('✅ Stored value at final property "' + config.updateJsonPath + '":', extractedValue)
            console.log('✅ Updated context data with API response')

            console.log('🔍 === STEP 4: VERIFICATION ===')
            console.log('🔍 DEBUG - Full contextData after update:', JSON.stringify(contextData))
            console.log('🔍 DEBUG - contextData keys after update:', Object.keys(contextData))
            console.log('🔍 DEBUG - Verification read result:', contextData[config.updateJsonPath])
            console.log('🔍 DEBUG - Verifying stored value by re-reading path:', config.updateJsonPath)

            const verificationValue = getValueByPath(contextData, config.updateJsonPath)

            if (verificationValue === extractedValue) {
              console.log('✅✅✅ VERIFICATION PASSED: Value successfully stored and retrieved!')
            } else {
              console.log('❌❌❌ VERIFICATION FAILED!')
              console.log('DIAGNOSTIC: updateJsonPath:', config.updateJsonPath)
              console.log('DIAGNOSTIC: Step Name:', step.step_name)
              console.log('DIAGNOSTIC: Values Match:', verificationValue === extractedValue)
              console.log('DIAGNOSTIC: Response value stored:', extractedValue)
              console.log('DIAGNOSTIC: contextData.extractedData?.orders?.[0]?.consignee?.clientId:', contextData.extractedData?.orders?.[0]?.consignee?.clientId)
              console.log('DIAGNOSTIC: contextData.orders[0]?.consignee?.clientId:', contextData.orders?.[0]?.consignee?.clientId)

              if (contextData.extractedData && contextData.orders) {
                const refCheck = contextData.extractedData.orders === contextData.orders
                console.log('DIAGNOSTIC: Reference Check:', refCheck ? 'SAME' : 'DIFFERENT')
              }
            }

            console.log('📊 === FINAL CONTEXT DATA SNAPSHOT ===')
            console.log('📊 contextData keys:', Object.keys(contextData))
            console.log('📊 Last API response:', JSON.stringify(contextData.lastApiResponse))
            console.log('📊 Full contextData:', JSON.stringify(contextData))
            console.log('📊 === END CONTEXT DATA SNAPSHOT ===')

            console.log('DIAGNOSTIC: AFTER UPDATE STEP', step.step_order)
            const clientIdFromOrders = getValueByPath(contextData, 'orders[0].consignee.clientId')
            console.log('DIAGNOSTIC: contextData.orders[0]?.consignee?.clientId:', clientIdFromOrders)
          }

          const stepEndTime = new Date().toISOString()
          const durationMs = Date.now() - stepStartTimestamp

          await createStepLog(
            supabaseUrl,
            supabaseServiceKey,
            workflowExecutionLogId,
            workflowId,
            step,
            'completed',
            stepStartTime,
            stepEndTime,
            durationMs,
            undefined,
            { url, method: config.method, requestBody },
            responseData
          )

          console.log(`✅ === STEP ${step.step_order} COMPLETED SUCCESSFULLY IN ${durationMs}ms ===`)

        } else if (step.step_type === 'rename_file') {
          console.log('📝 === EXECUTING RENAME FILE STEP ===')
          console.log('🔍 DEBUG - contextData keys at start of rename:', Object.keys(contextData))
          console.log('🔍 DEBUG - contextData.billNumber:', contextData.billNumber)

          const renameConfig = config
          console.log('🔧 Rename config:', JSON.stringify(renameConfig))

          console.log('📊 === FINAL CONTEXT DATA SNAPSHOT ===')
          console.log('📊 contextData keys:', Object.keys(contextData))
          console.log('🔍 DEBUG - lastApiResponse:', contextData.lastApiResponse)
          console.log('📄 Original template:', renameConfig.filenameTemplate)

          let baseFilename = renameConfig.filenameTemplate || 'renamed_file'

          const placeholderRegex = /\{\{([^}]+)\}\}/g
          let match
          const replacements: { placeholder: string, path: string }[] = []

          while ((match = placeholderRegex.exec(baseFilename)) !== null) {
            const placeholder = match[0]
            const path = match[1]
            replacements.push({ placeholder, path })
          }

          for (const { placeholder, path } of replacements) {
            console.log(`🔍 Replacing ${placeholder} (path: "${path}")`)
            const value = getValueByPath(contextData, path)
            console.log(`🔍   - Value from contextData: ${value}`)

            if (value !== undefined && value !== null) {
              const stringValue = String(value)
              baseFilename = baseFilename.replace(placeholder, stringValue)
              console.log(`🔍   - Replaced with: ${stringValue}`)
            } else {
              console.log(`⚠️   - Value not found, placeholder remains: ${placeholder}`)
            }
          }

          console.log('📄 Template after replacements:', baseFilename)

          if (renameConfig.appendTimestamp) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0]
            baseFilename = `${baseFilename}_${timestamp}`
          }

          console.log('⏰ Append timestamp:', renameConfig.appendTimestamp)
          console.log('📄 Base filename (without extension):', baseFilename)

          const filesToRename = {
            renamePdf: renameConfig.renamePdf || false,
            renameCsv: renameConfig.renameCsv || false,
            renameJson: renameConfig.renameJson || false,
            renameXml: renameConfig.renameXml || false
          }

          console.log('📋 File types to rename:', filesToRename)

          const renamedFilenames: { [key: string]: string } = {}

          if (filesToRename.renamePdf) {
            renamedFilenames.pdf = `${baseFilename}.pdf`
            contextData.renamedPdfFilename = renamedFilenames.pdf
            console.log('✅ Renamed PDF filename:', renamedFilenames.pdf)
          }

          if (filesToRename.renameCsv) {
            renamedFilenames.csv = `${baseFilename}.csv`
            contextData.renamedCsvFilename = renamedFilenames.csv
            console.log('✅ Renamed CSV filename:', renamedFilenames.csv)
          }

          if (filesToRename.renameJson) {
            renamedFilenames.json = `${baseFilename}.json`
            contextData.renamedJsonFilename = renamedFilenames.json
            console.log('✅ Renamed JSON filename:', renamedFilenames.json)
          }

          if (filesToRename.renameXml) {
            renamedFilenames.xml = `${baseFilename}.xml`
            contextData.renamedXmlFilename = renamedFilenames.xml
            console.log('✅ Renamed XML filename:', renamedFilenames.xml)
          }

          const primaryRenamedFilename = renamedFilenames.pdf || renamedFilenames.csv || renamedFilenames.json || renamedFilenames.xml || baseFilename
          contextData.renamedFilename = primaryRenamedFilename
          contextData.actualFilename = primaryRenamedFilename

          console.log('✅ Primary renamed filename:', primaryRenamedFilename)

          const stepEndTime = new Date().toISOString()
          const durationMs = Date.now() - stepStartTimestamp

          console.log('📊 === FINAL CONTEXT DATA SNAPSHOT ===')
          console.log('📊 contextData keys:', Object.keys(contextData))
          console.log('📊 Full contextData:', JSON.stringify(contextData))
          console.log('📊 === END CONTEXT DATA SNAPSHOT ===')

          await createStepLog(
            supabaseUrl,
            supabaseServiceKey,
            workflowExecutionLogId,
            workflowId,
            step,
            'completed',
            stepStartTime,
            stepEndTime,
            durationMs,
            undefined,
            { template: renameConfig.filenameTemplate, appendTimestamp: renameConfig.appendTimestamp },
            { renamedFilenames, primaryFilename: primaryRenamedFilename }
          )

          console.log(`✅ === STEP ${step.step_order} COMPLETED SUCCESSFULLY IN ${durationMs}ms ===`)

        } else if (step.step_type === 'sftp_upload') {
          console.log('📤 === EXECUTING SFTP UPLOAD STEP ===')

          const uploadConfig = config
          console.log('🔧 SFTP Upload config:', JSON.stringify(uploadConfig))

          const sftpFunctionUrl = `${supabaseUrl}/functions/v1/sftp-upload`

          const uploadPayload: any = {
            formatType: contextData.formatType || 'JSON',
            pdfBase64: contextData.pdfBase64,
            pdfFilename: contextData.actualFilename || contextData.renamedFilename || contextData.pdfFilename,
            extractedData: JSON.stringify(contextData.extractedData)
          }

          console.log('📦 Prepared upload payload (without base64):', {
            formatType: uploadPayload.formatType,
            pdfFilename: uploadPayload.pdfFilename,
            hasPdfBase64: !!uploadPayload.pdfBase64,
            hasExtractedData: !!uploadPayload.extractedData
          })

          console.log('🚀 Calling SFTP upload function...')

          const uploadResponse = await fetch(sftpFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.get('Authorization') || ''
            },
            body: JSON.stringify(uploadPayload)
          })

          console.log('📤 SFTP upload response status:', uploadResponse.status)

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text()
            console.error('❌ SFTP upload failed:', errorText)
            throw new Error(`SFTP upload failed: ${errorText}`)
          }

          const uploadResult = await uploadResponse.json()
          console.log('✅ SFTP upload successful:', JSON.stringify(uploadResult))

          if (uploadResult.actualFilename) {
            contextData.actualFilename = uploadResult.actualFilename
          }

          if (uploadResult.actualFilenames && Array.isArray(uploadResult.actualFilenames)) {
            contextData.actualFilenames = uploadResult.actualFilenames
          }

          const stepEndTime = new Date().toISOString()
          const durationMs = Date.now() - stepStartTimestamp

          console.log('📊 === FINAL CONTEXT DATA SNAPSHOT ===')
          console.log('📊 contextData keys:', Object.keys(contextData))
          console.log('📊 Full contextData:', JSON.stringify(contextData).substring(0, 5000))
          console.log('📊 === END CONTEXT DATA SNAPSHOT ===')

          await createStepLog(
            supabaseUrl,
            supabaseServiceKey,
            workflowExecutionLogId,
            workflowId,
            step,
            'completed',
            stepStartTime,
            stepEndTime,
            durationMs,
            undefined,
            { filename: uploadPayload.pdfFilename, formatType: uploadPayload.formatType },
            uploadResult
          )

          console.log(`✅ === STEP ${step.step_order} COMPLETED SUCCESSFULLY IN ${durationMs}ms ===`)

        } else {
          console.log(`⚠️ Unknown step type: ${step.step_type}`)

          const stepEndTime = new Date().toISOString()
          const durationMs = Date.now() - stepStartTimestamp

          await createStepLog(
            supabaseUrl,
            supabaseServiceKey,
            workflowExecutionLogId,
            workflowId,
            step,
            'skipped',
            stepStartTime,
            stepEndTime,
            durationMs,
            `Unknown step type: ${step.step_type}`
          )
        }

        console.log(`✅ DEBUG - Completed iteration i=${i} for step ${step.step_order}. Moving to next iteration.`)

      } catch (error) {
        console.error(`❌ Step ${step.step_order} failed:`, error)

        const stepEndTime = new Date().toISOString()
        const durationMs = Date.now() - stepStartTimestamp

        await createStepLog(
          supabaseUrl,
          supabaseServiceKey,
          workflowExecutionLogId,
          workflowId,
          step,
          'failed',
          stepStartTime,
          stepEndTime,
          durationMs,
          error instanceof Error ? error.message : String(error)
        )

        throw error
      }
    }

    console.log(`✅ DEBUG - Exited for loop. Total iterations should have been: ${steps.length}`)
    console.log('✅ === WORKFLOW EXECUTION COMPLETED ===')

    const workflowEndTime = new Date().toISOString()

    await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${workflowExecutionLogId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        status: 'completed',
        completed_at: workflowEndTime,
        output_data: contextData
      })
    })

    console.log('🎉 Workflow execution completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Workflow executed successfully',
        workflowExecutionLogId,
        contextData
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (error) {
    console.error('❌ Workflow execution error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
