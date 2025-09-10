import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface WorkflowExecutionRequest {
  extractedData: string
  workflowId: string
  userId?: string
  extractionTypeId?: string
  pdfFilename: string
  pdfPages: number
  pdfBase64: string
  originalPdfFilename: string
}

interface WorkflowStep {
  id: string
  workflow_id: string
  step_order: number
  step_type: 'api_call' | 'conditional_check' | 'data_transform' | 'sftp_upload'
  step_name: string
  config_json: any
  next_step_on_success_id?: string
  next_step_on_failure_id?: string
}

interface WorkflowExecutionLog {
  id: string
  extraction_log_id?: string
  workflow_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  current_step_id?: string
  current_step_name?: string
  error_message?: string
  context_data?: any
  started_at: string
  updated_at: string
  completed_at?: string
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  console.log('Workflow processor function called')
  
  let workflowExecutionLogId: string | undefined
  let extractionLogId: string | undefined
  
  try {
    const requestBody = await req.text()
    console.log('Raw request body length:', requestBody.length)
    console.log('Raw request body preview:', requestBody.substring(0, 500))
    
    let requestData: WorkflowExecutionRequest
    try {
      requestData = JSON.parse(requestBody)
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError)
      console.error('Request body that failed to parse:', requestBody)
      throw new Error(`Invalid JSON in request: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`)
    }
    
    const { extractedData, workflowId, userId, extractionTypeId, pdfFilename, pdfPages, pdfBase64, originalPdfFilename } = requestData
    
    console.log('Parsed request data:', {
      workflowId,
      userId,
      extractionTypeId,
      pdfFilename,
      pdfPages,
      extractedDataLength: extractedData?.length || 0,
      pdfBase64Length: pdfBase64?.length || 0,
      originalPdfFilename
    })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase configuration missing')
      throw new Error('Supabase configuration missing')
    }

    console.log('Creating extraction log entry...')
    
    // Create extraction log entry first
    const extractionLogResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_logs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId || null,
        extraction_type_id: extractionTypeId || null,
        pdf_filename: pdfFilename,
        pdf_pages: pdfPages,
        extraction_status: 'pending',
        extracted_data: extractedData,
        created_at: new Date().toISOString()
      })
    })

    if (!extractionLogResponse.ok) {
      const errorText = await extractionLogResponse.text()
      console.error('Failed to create extraction log:', errorText)
      throw new Error(`Failed to create extraction log: ${errorText}`)
    }

    const extractionLogData = await extractionLogResponse.json()
    console.log('Extraction log created:', extractionLogData)
    
    if (!extractionLogData || extractionLogData.length === 0) {
      console.error('No extraction log data returned')
      throw new Error('Failed to create extraction log - no data returned')
    }

    extractionLogId = extractionLogData[0].id
    if (!extractionLogId) {
      console.error('No extraction log ID returned')
      throw new Error('Failed to get extraction log ID')
    }

    // Get workflow steps
    console.log('Fetching workflow steps for workflow:', workflowId)
    const stepsResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_steps?workflow_id=eq.${workflowId}&order=step_order.asc`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    if (!stepsResponse.ok) {
      const errorText = await stepsResponse.text()
      console.error('Failed to fetch workflow steps:', errorText)
      throw new Error('Failed to fetch workflow steps')
    }

    const steps: WorkflowStep[] = await stepsResponse.json()
    console.log('Workflow steps loaded:', steps.length, 'steps')
    
    if (steps.length === 0) {
      console.error('No steps found for workflow:', workflowId)
      throw new Error('No steps found for workflow')
    }

    // Execute workflow steps
    let currentData = JSON.parse(extractedData)
    let currentStepIndex = 0
    let lastApiResponse: any = null
    
    console.log('Starting workflow execution with', steps.length, 'steps')

    const createStepLog = async (step: WorkflowStep, status: string, contextData: any, errorMessage?: string): Promise<string> => {
      console.log(`Creating step log for step ${step.step_order}: ${step.step_name} with status: ${status}`)
      try {
        const stepLogResponse = await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            extraction_log_id: extractionLogId,
            workflow_id: workflowId,
            status: status,
            current_step_id: step.id,
            current_step_name: `Step ${step.step_order}: ${step.step_name}`,
            error_message: errorMessage || null,
            context_data: {
              ...contextData,
              stepOrder: step.step_order,
              stepType: step.step_type,
              stepName: step.step_name,
            },
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null
          })
        })

        if (!stepLogResponse.ok) {
          const errorText = await stepLogResponse.text()
          console.error('Failed to create step log:', errorText)
          throw new Error(`Failed to create step log: ${errorText}`)
        } else {
          const stepLogData = await stepLogResponse.json()
          console.log('Step log created successfully:', stepLogData[0]?.id)
          return stepLogData[0]?.id
        }
      } catch (logError) {
        console.error('Error creating step log:', logError)
        throw logError
      }
    }

    while (currentStepIndex < steps.length) {
      const step = steps[currentStepIndex]
      console.log(`Executing step ${step.step_order}: ${step.step_name} (${step.step_type})`)
      
      // Create a running log for this step
      const stepLogId = await createStepLog(step, 'running', {
        extractedData: currentData,
        stepType: step.step_type
      })
      
      // Store the first step log ID as the main workflow execution log ID
      if (!workflowExecutionLogId) {
        workflowExecutionLogId = stepLogId
      }

      try {
        // Execute step based on type
        switch (step.step_type) {
          case 'api_call':
            console.log('Executing API call step...')
            const apiCallResult = await executeApiCall(step, currentData)
            currentData = apiCallResult.data
            lastApiResponse = apiCallResult.response
            
            // Update the step log to completed
            await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${stepLogId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({
                status: 'completed',
                context_data: {
                  extractedData: currentData,
                  apiResponse: apiCallResult.response,
                  stepType: 'api_call'
                },
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            })
            break
          case 'conditional_check':
            console.log('Executing conditional check step...')
            const conditionResult = await executeConditionalCheck(step, currentData)
            console.log('Condition result:', conditionResult)
            
            // Update the step log to completed
            await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${stepLogId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({
                status: 'completed',
                context_data: {
                  extractedData: currentData,
                  conditionResult: conditionResult,
                  stepType: 'conditional_check'
                },
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            })
            
            if (conditionResult.success) {
              if (step.next_step_on_success_id) {
                const nextStepIndex = steps.findIndex(s => s.id === step.next_step_on_success_id)
                if (nextStepIndex !== -1) {
                  console.log('Jumping to success step:', nextStepIndex + 1)
                  currentStepIndex = nextStepIndex
                  continue
                }
              }
            } else {
              if (step.next_step_on_failure_id) {
                const nextStepIndex = steps.findIndex(s => s.id === step.next_step_on_failure_id)
                if (nextStepIndex !== -1) {
                  console.log('Jumping to failure step:', nextStepIndex + 1)
                  currentStepIndex = nextStepIndex
                  continue
                }
              } else {
                console.error('Conditional check failed and no failure step defined')
                throw new Error(`Conditional check failed: ${conditionResult.message}`)
              }
            }
            break
          case 'data_transform':
            console.log('Executing data transform step...')
            currentData = await executeDataTransform(step, currentData)
            
            // Update the step log to completed
            await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${stepLogId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({
                status: 'completed',
                context_data: {
                  extractedData: currentData,
                  stepType: 'data_transform'
                },
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            })
            break
          case 'sftp_upload':
            console.log('Executing SFTP upload step...')
            await executeSftpUpload(step, currentData, lastApiResponse, pdfBase64, originalPdfFilename, supabaseUrl, supabaseServiceKey)
            
            // Update the step log to completed
            await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${stepLogId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({
                status: 'completed',
                context_data: {
                  extractedData: currentData,
                  stepType: 'sftp_upload'
                },
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
            })
            break
          default:
            console.error('Unknown step type:', step.step_type)
            throw new Error(`Unknown step type: ${step.step_type}`)
        }

        console.log(`Step ${step.step_order} completed successfully`)
        
        currentStepIndex++
      } catch (stepError) {
        console.error(`Step ${step.step_order} failed:`, stepError)
        
        // Update the step log to failed
        await fetch(`${supabaseUrl}/rest/v1/workflow_execution_logs?id=eq.${stepLogId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({
            status: 'failed',
            error_message: stepError instanceof Error ? stepError.message : 'Unknown error',
            context_data: {
              extractedData: currentData,
              stepType: step.step_type
            },
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        })

        // Update extraction log status
        console.log('Updating extraction log with failure status...')
        try {
          await fetch(`${supabaseUrl}/rest/v1/extraction_logs?id=eq.${extractionLogId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              extraction_status: 'failed',
              updated_at: new Date().toISOString()
            })
          })
        } catch (updateError) {
          console.error('Failed to update extraction log with error:', updateError)
        }

        throw stepError
      }
    }

    console.log('All workflow steps completed successfully')
    
    // Update extraction log status
    console.log('Updating extraction log with success status...')
    try {
      await fetch(`${supabaseUrl}/rest/v1/extraction_logs?id=eq.${extractionLogId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          extraction_status: 'success',
          updated_at: new Date().toISOString()
        })
      })
    } catch (updateError) {
      console.error('Failed to update extraction log with success:', updateError)
    }

    console.log('Workflow execution completed successfully')
    
    return new Response(
      JSON.stringify({ 
        success: true,
        extractionLogId: extractionLogId,
        workflowExecutionLogId: workflowExecutionLogId,
        finalData: currentData,
        lastApiResponse: lastApiResponse,
        message: 'Workflow executed successfully'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Workflow execution error:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace')
    
    // Update extraction log with failure status if available
    if (extractionLogId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        
        if (supabaseUrl && supabaseServiceKey) {
          console.log('Updating extraction log with failure status...')
          await fetch(`${supabaseUrl}/rest/v1/extraction_logs?id=eq.${extractionLogId}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey
            },
            body: JSON.stringify({
              extraction_status: 'failed',
              error_message: error instanceof Error ? error.message : 'Workflow execution failed',
              updated_at: new Date().toISOString()
            })
          })
        }
      } catch (updateError) {
        console.error('Failed to update extraction log with failure:', updateError)
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: "Workflow execution failed", 
        details: error instanceof Error ? error.message : "Unknown error",
        extractionLogId: extractionLogId,
        workflowExecutionLogId: workflowExecutionLogId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

async function executeApiCall(step: WorkflowStep, data: any): Promise<{ data: any; response: any }> {
  const config = step.config_json
  
  console.log('Executing API call step:', step.step_name)
  console.log('API call config:', config)
  
  if (!config.url) {
    throw new Error('API call step missing URL configuration')
  }

  // Replace template variables in request body
  let requestBody = config.requestBody || ''
  console.log('Original request body template:', requestBody)
  
  if (requestBody) {
    // Check if the request body is exactly '{{extractedData}}' - handle this special case
    if (requestBody.trim() === '{{extractedData}}') {
      requestBody = JSON.stringify(data)
      console.log('Used extractedData directly as request body:', requestBody)
    } else {
      // Parse the request body template as JSON first
      let requestBodyObject: any
      try {
        requestBodyObject = JSON.parse(requestBody)
        console.log('Parsed request body template as object:', requestBodyObject)
      } catch (parseError) {
        console.error('Failed to parse request body template as JSON:', parseError)
        console.error('Request body template that failed to parse:', requestBody)
        throw new Error(`Invalid JSON in request body template: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`)
      }
      
      // Replace placeholders in the parsed object structure
      const processedBodyObject = replacePlaceholdersInObject(requestBodyObject, data)
      console.log('Request body object after placeholder replacement:', processedBodyObject)
      
      // Convert back to JSON string
      requestBody = JSON.stringify(processedBodyObject)
      console.log('Final stringified request body:', requestBody)
    }
  }
  
  // Replace template variables in URL
  const finalUrl = replaceTemplateVariables(config.url, data)
  console.log('Final URL after template replacement:', finalUrl)

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers
  }
  
  console.log('Request headers:', headers)
  console.log('Request method:', config.method || 'POST')

  // Determine method and body - GET/HEAD methods cannot have body
  const method = config.method || 'POST'
  const shouldHaveBody = method !== 'GET' && method !== 'HEAD'
  const body = shouldHaveBody ? requestBody || undefined : undefined

  console.log('Final request body being sent:', body)
  console.log('Request body length:', body ? body.length : 0)
  console.log('Request body type:', typeof body)

  // Make API call
  const response = await fetch(finalUrl, {
    method,
    headers,
    body
  })
  
  console.log('API response status:', response.status)
  console.log('API response ok:', response.ok)
  console.log('API response headers:', Object.fromEntries(response.headers.entries()))

  if (!response.ok) {
    const errorText = await response.text()
    console.error('API call failed:', response.status, response.statusText, errorText)
    console.error('Failed request details:', {
      url: finalUrl,
      method: method,
      headers: headers,
      body: body
    })
    throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const responseData = await response.json()
  console.log('API response data:', responseData)

  // Extract data from response if path specified
  let extractedValue = responseData
  if (config.responseDataPath) {
    extractedValue = getValueByPath(responseData, config.responseDataPath)
  }

  // Update the main data if update path specified
  if (config.updateJsonPath && extractedValue !== undefined) {
    setValueByPath(data, config.updateJsonPath, extractedValue)
  }

  return {
    data: data,
    response: responseData
  }
}

function replacePlaceholdersInObject(obj: any, data: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => replacePlaceholdersInObject(item, data))
  } else if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replacePlaceholdersInObject(value, data)
    }
    return result
  } else if (typeof obj === 'string') {
    // Check if the entire string is a single placeholder
    const singlePlaceholderMatch = obj.match(/^\{\{([^}]+)\}\}$/)
    if (singlePlaceholderMatch) {
      const path = singlePlaceholderMatch[1].trim()
      console.log('Replacing single placeholder:', path)
      
      // Special handling for extractedData - return the entire data object
      if (path === 'extractedData') {
        console.log('Returning entire extractedData object')
        return data
      }
      
      const value = getValueByPath(data, path)
      console.log('Single placeholder value:', value)
      return value !== undefined ? value : obj
    } else {
      // Handle multiple placeholders or mixed content in string
      return replaceTemplateVariables(obj, data)
    }
  } else {
    return obj
  }
}

async function executeConditionalCheck(step: WorkflowStep, data: any): Promise<{ success: boolean; message: string }> {
  const config = step.config_json
  
  if (!config.jsonPath) {
    throw new Error('Conditional check step missing JSON path configuration')
  }

  const value = getValueByPath(data, config.jsonPath)
  
  switch (config.conditionType) {
    case 'is_null':
      return { success: value === null || value === undefined || value === '', message: `Value is ${value === null || value === undefined || value === '' ? 'null/empty' : 'not null/empty'}` }
    case 'is_not_null':
      return { success: value !== null && value !== undefined && value !== '', message: `Value is ${value !== null && value !== undefined && value !== '' ? 'not null/empty' : 'null/empty'}` }
    case 'equals':
      return { success: value === config.expectedValue, message: `Value ${value} ${value === config.expectedValue ? 'equals' : 'does not equal'} ${config.expectedValue}` }
    case 'contains':
      const contains = String(value).includes(config.expectedValue)
      return { success: contains, message: `Value ${value} ${contains ? 'contains' : 'does not contain'} ${config.expectedValue}` }
    case 'greater_than':
      const greater = Number(value) > Number(config.expectedValue)
      return { success: greater, message: `Value ${value} is ${greater ? 'greater than' : 'not greater than'} ${config.expectedValue}` }
    case 'less_than':
      const less = Number(value) < Number(config.expectedValue)
      return { success: less, message: `Value ${value} is ${less ? 'less than' : 'not less than'} ${config.expectedValue}` }
    default:
      throw new Error(`Unknown condition type: ${config.conditionType}`)
  }
}

async function executeDataTransform(step: WorkflowStep, data: any): Promise<any> {
  const config = step.config_json
  
  if (!config.transformations || !Array.isArray(config.transformations)) {
    throw new Error('Data transform step missing transformations configuration')
  }

  for (const transformation of config.transformations) {
    switch (transformation.operation) {
      case 'set_value':
        setValueByPath(data, transformation.jsonPath, transformation.value)
        break
      case 'copy_from':
        if (transformation.sourceJsonPath) {
          const sourceValue = getValueByPath(data, transformation.sourceJsonPath)
          setValueByPath(data, transformation.jsonPath, sourceValue)
        }
        break
      case 'append':
        const currentValue = getValueByPath(data, transformation.jsonPath)
        if (Array.isArray(currentValue)) {
          currentValue.push(transformation.value)
        } else {
          setValueByPath(data, transformation.jsonPath, String(currentValue || '') + String(transformation.value || ''))
        }
        break
      case 'remove':
        removeValueByPath(data, transformation.jsonPath)
        break
      case 'format_phone_us':
        const phoneValue = getValueByPath(data, transformation.jsonPath)
        if (phoneValue) {
          const formattedPhone = formatPhoneNumber(String(phoneValue))
          if (formattedPhone !== null) {
            setValueByPath(data, transformation.jsonPath, formattedPhone)
          } else {
            setValueByPath(data, transformation.jsonPath, null)
          }
        }
        break
      default:
        throw new Error(`Unknown transformation operation: ${transformation.operation}`)
    }
  }

  return data
}

function formatPhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Only format if we have exactly 10 digits or 11 digits starting with '1'
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // Remove leading '1' and format the remaining 10 digits
    const tenDigits = digits.slice(1)
    return `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`
  }
  
  // Return null for invalid phone numbers to prevent API validation errors
  return null
}

async function executeSftpUpload(step: WorkflowStep, extractedData: any, lastApiResponse: any, pdfBase64: string, originalPdfFilename: string, supabaseUrl: string, supabaseServiceKey: string): Promise<void> {
  const config = step.config_json
  
  console.log('Executing SFTP upload step:', step.step_name)
  console.log('SFTP upload config:', config)
  
  if (!pdfBase64) {
    throw new Error('PDF data not available for SFTP upload')
  }

  // Get SFTP configuration from database
  const sftpResponse = await fetch(`${supabaseUrl}/rest/v1/sftp_config?order=updated_at.desc&limit=1`, {
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey
    }
  })

  if (!sftpResponse.ok) {
    throw new Error('Failed to fetch SFTP configuration')
  }

  const sftpData = await sftpResponse.json()
  if (!sftpData || sftpData.length === 0) {
    throw new Error('No SFTP configuration found')
  }

  const sftpConfig = {
    host: sftpData[0].host,
    port: sftpData[0].port,
    username: sftpData[0].username,
    password: sftpData[0].password,
    xmlPath: sftpData[0].remote_path,
    pdfPath: sftpData[0].pdf_path,
    jsonPath: sftpData[0].json_path
  }

  // Determine custom filename part based on configuration
  let customFilenamePart: string | undefined
  
  if (config.useApiResponseForFilename && config.filenameSourcePath) {
    // Try to extract filename from API response first
    if (lastApiResponse) {
      customFilenamePart = getValueByPath(lastApiResponse, config.filenameSourcePath)
      console.log('Extracted filename from API response:', customFilenamePart)
    }
    
    // If not found in API response, try extracted data
    if (!customFilenamePart) {
      customFilenamePart = getValueByPath(extractedData, config.filenameSourcePath)
      console.log('Extracted filename from extracted data:', customFilenamePart)
    }
  }
  
  // Note: customFilenamePart should only contain the extracted billNumber
  // The fallbackFilename (base prefix) is passed separately as baseFilename
  console.log('Final customFilenamePart (billNumber only):', customFilenamePart)

  // Call the SFTP upload function
  const sftpUploadResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey
    },
    body: JSON.stringify({
      sftpConfig: sftpConfig,
      xmlContent: JSON.stringify(extractedData),
      pdfBase64: pdfBase64,
      baseFilename: config.fallbackFilename || 'document',
      originalFilename: originalPdfFilename,
      customFilenamePart: customFilenamePart,
      formatType: 'JSON' // Assuming JSON since this is in workflow context
    })
  })

  if (!sftpUploadResponse.ok) {
    const errorData = await sftpUploadResponse.json()
    throw new Error(`SFTP upload failed: ${errorData.details || errorData.error || 'Unknown error'}`)
  }

  const uploadResult = await sftpUploadResponse.json()
  console.log('SFTP upload completed successfully:', uploadResult)
}

function replaceTemplateVariables(template: string, data: any): string {
  const result = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim()
    
    // Special handling for extractedData - insert as JSON object, not string
    if (trimmedPath === 'extractedData') {
      return JSON.stringify(data)
    }
    
    const value = getValueByPath(data, trimmedPath)
    // URL encode the value if it's being used in a URL context
    if (value !== undefined) {
      const stringValue = String(value)
      // Only URL encode if this appears to be in a URL context (contains http or has query parameters)
      if (template.includes('http') && (template.includes('?') || template.includes('&'))) {
        return encodeURIComponent(stringValue)
      }
      return stringValue
    }
    return match
  })
  
  console.log('Template replacement:', { original: template, result })
  return result
}

function getValueByPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined
    if (key.includes('[') && key.includes(']')) {
      const [arrayKey, indexStr] = key.split('[')
      const index = parseInt(indexStr.replace(']', ''))
      return current[arrayKey] && current[arrayKey][index]
    }
    return current[key]
  }, obj)
}

function setValueByPath(obj: any, path: string, value: any): void {
  const keys = path.split('.')
  const lastKey = keys.pop()
  
  if (!lastKey) return
  
  let current = obj
  for (const key of keys) {
    if (key.includes('[') && key.includes(']')) {
      const [arrayKey, indexStr] = key.split('[')
      const index = parseInt(indexStr.replace(']', ''))
      if (!current[arrayKey]) current[arrayKey] = []
      if (!current[arrayKey][index]) current[arrayKey][index] = {}
      current = current[arrayKey][index]
    } else {
      if (!current[key]) current[key] = {}
      current = current[key]
    }
  }
  
  if (lastKey.includes('[') && lastKey.includes(']')) {
    const [arrayKey, indexStr] = lastKey.split('[')
    const index = parseInt(indexStr.replace(']', ''))
    if (!current[arrayKey]) current[arrayKey] = []
    current[arrayKey][index] = value
  } else {
    current[lastKey] = value
  }
}

function removeValueByPath(obj: any, path: string): void {
  const keys = path.split('.')
  const lastKey = keys.pop()
  
  if (!lastKey) return
  
  let current = obj
  for (const key of keys) {
    if (key.includes('[') && key.includes(']')) {
      const [arrayKey, indexStr] = key.split('[')
      const index = parseInt(indexStr.replace(']', ''))
      current = current[arrayKey] && current[arrayKey][index]
    } else {
      current = current[key]
    }
    if (!current) return
  }
  
  if (lastKey.includes('[') && lastKey.includes(']')) {
    const [arrayKey, indexStr] = lastKey.split('[')
    const index = parseInt(indexStr.replace(']', ''))
    if (current[arrayKey] && Array.isArray(current[arrayKey])) {
      current[arrayKey].splice(index, 1)
    }
  } else {
    delete current[lastKey]
  }
}