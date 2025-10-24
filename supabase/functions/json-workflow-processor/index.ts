import { Buffer } from "node:buffer"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { PDFDocument } from 'npm:pdf-lib@1.17.1'

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
  formatType?: string
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

interface EmailConfig {
  provider: 'office365' | 'gmail'
  office365?: {
    tenant_id: string
    client_id: string
    client_secret: string
    default_send_from_email: string
  }
  gmail?: {
    client_id: string
    client_secret: string
    refresh_token: string
    default_send_from_email: string
  }
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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('✅ Supabase client initialized')

    let requestData: WorkflowExecutionRequest
    try {
      console.log('📥 Reading request body...')
      const requestText = await req.text()
      console.log('📏 Request body size:', requestText.length, 'characters')

      if (!requestText || requestText.trim() === '') {
        throw new Error('Request body is empty')
      }

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

    const { data: workflow, error: workflowError } = await supabase
      .from('extraction_workflows')
      .select('*')
      .eq('id', requestData.workflowId)
      .single()

    if (workflowError || !workflow) {
      console.error('❌ Workflow not found:', workflowError)
      return new Response(
        JSON.stringify({ error: "Workflow not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log('✅ Found workflow:', workflow.name)

    const { data: steps, error: stepsError } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', requestData.workflowId)
      .order('step_order', { ascending: true })

    if (stepsError) {
      console.error('❌ Failed to fetch workflow steps:', stepsError)
      return new Response(
        JSON.stringify({ error: "Failed to fetch workflow steps" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    console.log('✅ Found', steps?.length || 0, 'workflow steps')

    const { data: executionLog, error: executionLogError } = await supabase
      .from('workflow_execution_logs')
      .insert({
        workflow_id: requestData.workflowId,
        status: 'running',
        context_data: {
          pdfFilename: requestData.pdfFilename,
          originalPdfFilename: requestData.originalPdfFilename,
          extractedData: requestData.extractedData,
          pdfPages: requestData.pdfPages
        }
      })
      .select()
      .single()

    if (executionLogError || !executionLog) {
      console.error('❌ Failed to create execution log:', executionLogError)
      return new Response(
        JSON.stringify({ error: "Failed to create execution log" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    workflowExecutionLogId = executionLog.id
    console.log('✅ Created workflow execution log:', workflowExecutionLogId)

    let contextData: any = {
      extractedData: requestData.extractedData,
      pdfFilename: requestData.pdfFilename,
      originalPdfFilename: requestData.originalPdfFilename,
      transformSetupFilename: requestData.pdfFilename,
      pdfBase64: requestData.pdfBase64,
      pdfPages: requestData.pdfPages,
      formatType: requestData.formatType
    }

    console.log('📋 Initial context data:')
    console.log('  - pdfFilename (current):', contextData.pdfFilename)
    console.log('  - transformSetupFilename (from transform setup):', contextData.transformSetupFilename)
    console.log('  - originalPdfFilename:', contextData.originalPdfFilename)

    for (const step of (steps || [])) {
      console.log(`\n🔄 === EXECUTING STEP ${step.step_order}: ${step.step_name} ===`)
      const stepStartTime = Date.now()

      const { data: stepLog, error: stepLogError } = await supabase
        .from('workflow_step_logs')
        .insert({
          workflow_execution_log_id: workflowExecutionLogId,
          workflow_id: requestData.workflowId,
          step_id: step.id,
          step_name: step.step_name,
          step_type: step.step_type,
          step_order: step.step_order,
          status: 'running',
          input_data: contextData
        })
        .select()
        .single()

      if (stepLogError) {
        console.error('❌ Failed to create step log:', stepLogError)
      }

      const stepLogId = stepLog?.id

      try {
        await supabase
          .from('workflow_execution_logs')
          .update({
            current_step_id: step.id,
            current_step_name: step.step_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', workflowExecutionLogId)

        let stepResult: any
        switch (step.step_type) {
          case 'email_action':
            stepResult = await executeEmailAction(step, contextData, supabase)
            break

          case 'rename_pdf':
            stepResult = await executeRenamePdf(step, contextData)
            break

          case 'sftp_upload':
            stepResult = await executeSftpUpload(step, contextData, supabase, requestData)
            break

          default:
            console.log(`⚠️  Step type ${step.step_type} not yet implemented`)
            stepResult = { success: true, message: `Step type ${step.step_type} skipped` }
        }

        const stepDuration = Date.now() - stepStartTime
        console.log(`✅ Step completed in ${stepDuration}ms`)

        if (stepResult.contextUpdate) {
          contextData = { ...contextData, ...stepResult.contextUpdate }
        }

        if (stepLogId) {
          await supabase
            .from('workflow_step_logs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              duration_ms: stepDuration,
              output_data: stepResult
            })
            .eq('id', stepLogId)
        }

      } catch (stepError) {
        const stepDuration = Date.now() - stepStartTime
        const errorMessage = stepError instanceof Error ? stepError.message : 'Unknown error'
        console.error(`❌ Step failed: ${errorMessage}`)

        if (stepLogId) {
          await supabase
            .from('workflow_step_logs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              duration_ms: stepDuration,
              error_message: errorMessage
            })
            .eq('id', stepLogId)
        }

        await supabase
          .from('workflow_execution_logs')
          .update({
            status: 'failed',
            error_message: `Step "${step.step_name}" failed: ${errorMessage}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', workflowExecutionLogId)

        return new Response(
          JSON.stringify({
            error: `Workflow failed at step "${step.step_name}"`,
            details: errorMessage,
            workflowExecutionLogId,
            step: step.step_name
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        )
      }
    }

    await supabase
      .from('workflow_execution_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', workflowExecutionLogId)

    console.log('✅ === WORKFLOW COMPLETED SUCCESSFULLY ===')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Workflow completed successfully',
        workflowExecutionLogId,
        stepsExecuted: steps?.length || 0
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )

  } catch (error) {
    console.error("❌ Workflow processor error:", error)

    return new Response(
      JSON.stringify({
        error: "Workflow execution failed",
        details: error instanceof Error ? error.message : "Unknown error",
        workflowExecutionLogId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

async function executeEmailAction(step: WorkflowStep, contextData: any, supabase: any): Promise<any> {
  console.log('📧 === EXECUTING EMAIL ACTION ===')
  console.log('📧 Step config:', JSON.stringify(step.config_json, null, 2))
  console.log('📧 Context data keys:', Object.keys(contextData))
  console.log('📧 Context pdfFilename:', contextData.pdfFilename)
  console.log('📧 Context renamedFilename:', contextData.renamedFilename)
  console.log('📧 Context originalPdfFilename:', contextData.originalPdfFilename)

  const config = step.config_json
  const actionType = config.actionType || 'send_email'

  if (actionType !== 'send_email') {
    throw new Error(`Email action type "${actionType}" not supported`)
  }

  const { data: emailConfig, error: emailConfigError } = await supabase
    .from('email_monitoring_config')
    .select('*')
    .single()

  if (emailConfigError || !emailConfig) {
    console.error('❌ Failed to fetch email configuration:', emailConfigError)
    throw new Error('Email configuration not found. Please configure email settings first.')
  }

  console.log('✅ Email config loaded, provider:', emailConfig.provider)

  const toAddress = replaceTemplateVariables(config.to, contextData)
  const fromAddress = config.from ? replaceTemplateVariables(config.from, contextData) : emailConfig.default_send_from_email
  const subject = replaceTemplateVariables(config.subject, contextData)
  const body = replaceTemplateVariables(config.body, contextData)

  console.log('📧 Email details:')
  console.log('📧   To:', toAddress)
  console.log('📧   From:', fromAddress)
  console.log('📧   Subject:', subject)
  console.log('📧   Body:', body)
  console.log('📧   Include attachment:', config.includeAttachment)
  console.log('📧   Attachment source:', config.attachmentSource)
  console.log('📧   PDF email strategy:', config.pdfEmailStrategy || 'all_pages_in_group')
  console.log('📧   Specific page to email:', config.specificPageToEmail)

  if (!toAddress) {
    throw new Error('Email "To" address is required')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(toAddress)) {
    throw new Error(`Invalid recipient email address: ${toAddress}`)
  }

  let pdfAttachment: { filename: string; content: string } | null = null

  if (config.includeAttachment && contextData.pdfBase64) {
    let attachmentFilename: string
    const attachmentSource = config.attachmentSource || 'transform_setup_pdf'

    console.log('📧 Attachment source selected:', attachmentSource)
    console.log('📧 Available filenames in context:')
    console.log('  - renamedFilename (from rename step):', contextData.renamedFilename)
    console.log('  - transformSetupFilename (from transform setup):', contextData.transformSetupFilename)
    console.log('  - pdfFilename (current):', contextData.pdfFilename)
    console.log('  - originalPdfFilename:', contextData.originalPdfFilename)

    if (attachmentSource === 'renamed_pdf_step') {
      if (contextData.renamedFilename) {
        attachmentFilename = contextData.renamedFilename
        console.log('📧 ✅ Using renamedFilename from rename step:', attachmentFilename)
      } else {
        attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf'
        console.log('📧 ⚠️  No renamedFilename from step, falling back to originalPdfFilename:', attachmentFilename)
      }
    } else if (attachmentSource === 'transform_setup_pdf') {
      if (contextData.transformSetupFilename) {
        attachmentFilename = contextData.transformSetupFilename
        console.log('📧 ✅ Using transformSetupFilename from transform setup:', attachmentFilename)
      } else if (contextData.pdfFilename) {
        attachmentFilename = contextData.pdfFilename
        console.log('📧 ✅ Using pdfFilename from transform setup:', attachmentFilename)
      } else {
        attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf'
        console.log('📧 ⚠️  No transform setup filename, falling back to originalPdfFilename:', attachmentFilename)
      }
    } else if (attachmentSource === 'original_pdf') {
      attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf'
      console.log('📧 ✅ Using originalPdfFilename:', attachmentFilename)
    } else {
      if (contextData.renamedFilename) {
        attachmentFilename = contextData.renamedFilename
        console.log('📧 ✅ Using renamedFilename (legacy mode):', attachmentFilename)
      } else if (contextData.transformSetupFilename || contextData.pdfFilename) {
        attachmentFilename = contextData.transformSetupFilename || contextData.pdfFilename
        console.log('📧 ✅ Using transform setup filename (legacy mode):', attachmentFilename)
      } else {
        attachmentFilename = contextData.originalPdfFilename || 'attachment.pdf'
        console.log('📧 ⚠️  Using fallback to originalPdfFilename (legacy mode):', attachmentFilename)
      }
    }

    let pdfContent = contextData.pdfBase64

    const pdfEmailStrategy = config.pdfEmailStrategy || 'all_pages_in_group'
    if (pdfEmailStrategy === 'specific_page_in_group' && config.specificPageToEmail) {
      const pageToEmail = config.specificPageToEmail
      console.log(`📧 Extracting page ${pageToEmail} from PDF for email attachment`)

      try {
        pdfContent = await extractSpecificPageFromPdf(contextData.pdfBase64, pageToEmail)
        console.log(`📧 ✅ Successfully extracted page ${pageToEmail} from PDF`)
      } catch (extractError) {
        console.error(`📧 ❌ Failed to extract page ${pageToEmail}:`, extractError)
        throw new Error(`Failed to extract page ${pageToEmail} from PDF: ${extractError instanceof Error ? extractError.message : 'Unknown error'}`)
      }
    } else {
      console.log('📧 Using full PDF (all pages in group) for email attachment')
    }

    pdfAttachment = {
      filename: attachmentFilename,
      content: pdfContent
    }
    console.log('📧 PDF attachment prepared with filename:', attachmentFilename)
  }

  if (emailConfig.provider === 'office365') {
    return await sendEmailOffice365(emailConfig, toAddress, fromAddress, subject, body, pdfAttachment)
  } else if (emailConfig.provider === 'gmail') {
    return await sendEmailGmail(emailConfig, toAddress, fromAddress, subject, body, pdfAttachment)
  } else {
    throw new Error(`Email provider "${emailConfig.provider}" not supported`)
  }
}

async function sendEmailOffice365(
  emailConfig: any,
  toAddress: string,
  fromAddress: string,
  subject: string,
  body: string,
  attachment: { filename: string; content: string } | null
): Promise<any> {
  console.log('📧 === SENDING EMAIL VIA OFFICE 365 ===')

  const tenantId = emailConfig.tenant_id
  const clientId = emailConfig.client_id
  const clientSecret = emailConfig.client_secret

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Office 365 configuration incomplete (missing tenant_id, client_id, or client_secret)')
  }

  console.log('📧 🔑 Getting Office 365 access token...')
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams
  })

  const tokenData = await tokenResponse.json()
  console.log('📧 Token response status:', tokenResponse.status)

  if (!tokenResponse.ok) {
    console.error('📧 ❌ Token request failed:', tokenData)
    throw new Error(`Failed to get Office 365 access token: ${tokenData.error_description || tokenData.error}`)
  }

  console.log('📧 ✅ Access token acquired')

  const emailMessage: any = {
    message: {
      subject: subject,
      body: {
        contentType: 'Text',
        content: body
      },
      toRecipients: [
        {
          emailAddress: {
            address: toAddress
          }
        }
      ],
      from: {
        emailAddress: {
          address: fromAddress
        }
      }
    }
  }

  if (attachment) {
    console.log('📧 📎 Adding PDF attachment:', attachment.filename)
    emailMessage.message.attachments = [
      {
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: attachment.filename,
        contentType: "application/pdf",
        contentBytes: attachment.content
      }
    ]
  }

  console.log('📧 🚀 Sending email via Microsoft Graph API...')
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${fromAddress}/sendMail`

  const graphResponse = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailMessage)
  })

  console.log('📧 Graph API response status:', graphResponse.status)

  if (!graphResponse.ok) {
    const errorText = await graphResponse.text()
    console.error('📧 ❌ Microsoft Graph API error:', errorText)

    let errorDetails = errorText
    try {
      const errorData = JSON.parse(errorText)
      errorDetails = errorData.error?.message || errorData.error_description || errorText
    } catch (e) {
      // Use raw response
    }

    throw new Error(`Microsoft Graph API error (${graphResponse.status}): ${errorDetails}`)
  }

  console.log('📧 ✅ EMAIL SENT SUCCESSFULLY via Office 365')
  console.log('📧   From:', fromAddress)
  console.log('📧   To:', toAddress)
  console.log('📧   Subject:', subject)
  console.log('📧   Attachment:', attachment ? attachment.filename : 'none')

  return {
    success: true,
    provider: 'office365',
    fromAddress,
    toAddress,
    subject,
    attachmentIncluded: !!attachment,
    attachmentFilename: attachment?.filename,
    timestamp: new Date().toISOString()
  }
}

async function sendEmailGmail(
  emailConfig: any,
  toAddress: string,
  fromAddress: string,
  subject: string,
  body: string,
  attachment: { filename: string; content: string } | null
): Promise<any> {
  console.log('📧 === SENDING EMAIL VIA GMAIL ===')

  const clientId = emailConfig.gmail_client_id
  const clientSecret = emailConfig.gmail_client_secret
  const refreshToken = emailConfig.gmail_refresh_token

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail configuration incomplete (missing client_id, client_secret, or refresh_token)')
  }

  console.log('📧 🔑 Refreshing Gmail access token...')
  const tokenUrl = 'https://oauth2.googleapis.com/token'

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  })

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams
  })

  const tokenData = await tokenResponse.json()
  console.log('📧 Gmail token response status:', tokenResponse.status)

  if (!tokenResponse.ok) {
    console.error('📧 ❌ Gmail token request failed:', tokenData)
    throw new Error(`Failed to refresh Gmail access token: ${tokenData.error_description || tokenData.error}`)
  }

  console.log('📧 ✅ Gmail access token refreshed')

  let emailMessage: string

  if (attachment) {
    console.log('📧 📎 Creating email with PDF attachment:', attachment.filename)

    const boundary = '----=_Part_' + Date.now()
    const emailLines = [
      `To: ${toAddress}`,
      `From: ${fromAddress}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      '',
      body,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; name="${attachment.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      attachment.content,
      '',
      `--${boundary}--`
    ]
    emailMessage = emailLines.join('\r\n')
  } else {
    const emailLines = [
      `To: ${toAddress}`,
      `From: ${fromAddress}`,
      `Subject: ${subject}`,
      '',
      body
    ]
    emailMessage = emailLines.join('\r\n')
  }

  const encodedMessage = btoa(emailMessage).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  console.log('📧 🚀 Sending email via Gmail API...')
  const gmailUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

  const gmailResponse = await fetch(gmailUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedMessage })
  })

  console.log('📧 Gmail API response status:', gmailResponse.status)
  const gmailResponseData = await gmailResponse.json()

  if (!gmailResponse.ok) {
    console.error('📧 ❌ Gmail API error:', gmailResponseData)
    throw new Error(`Gmail API error (${gmailResponse.status}): ${JSON.stringify(gmailResponseData)}`)
  }

  console.log('📧 ✅ EMAIL SENT SUCCESSFULLY via Gmail')
  console.log('📧   From:', fromAddress)
  console.log('📧   To:', toAddress)
  console.log('📧   Subject:', subject)
  console.log('📧   Attachment:', attachment ? attachment.filename : 'none')
  console.log('📧   Gmail message ID:', gmailResponseData.id)

  return {
    success: true,
    provider: 'gmail',
    fromAddress,
    toAddress,
    subject,
    attachmentIncluded: !!attachment,
    attachmentFilename: attachment?.filename,
    gmailMessageId: gmailResponseData.id,
    timestamp: new Date().toISOString()
  }
}

async function executeRenamePdf(step: WorkflowStep, contextData: any): Promise<any> {
  console.log('📝 === EXECUTING RENAME FILE ===')
  console.log('📝 Step config:', JSON.stringify(step.config_json, null, 2))

  const config = step.config_json
  const template = config.filenameTemplate || config.template

  if (!template) {
    throw new Error('Filename template is required for rename_pdf step')
  }

  let newFilename = replaceTemplateVariables(template, contextData)

  // Detect file extension from context data or template
  let fileExtension = '.pdf' // default

  // Check if template already has an extension
  const hasExtension = /\.(pdf|csv|json|xml)$/i.test(newFilename)

  if (!hasExtension) {
    // Auto-detect extension based on format type in context
    const formatType = contextData.formatType || contextData.extractionType?.formatType
    console.log('📝 Detected format type:', formatType)

    if (formatType === 'CSV') {
      fileExtension = '.csv'
    } else if (formatType === 'JSON') {
      fileExtension = '.json'
    } else if (formatType === 'XML') {
      fileExtension = '.xml'
    }
    // else default to .pdf
  } else {
    // Extract the extension from the filename
    const match = newFilename.match(/\.(pdf|csv|json|xml)$/i)
    if (match) {
      fileExtension = match[0].toLowerCase()
      newFilename = newFilename.substring(0, newFilename.length - fileExtension.length)
    }
  }

  // Add timestamp if configured
  if (config.appendTimestamp) {
    const timestamp = generateTimestamp(config.timestampFormat || 'YYYYMMDD')
    newFilename = `${newFilename}_${timestamp}`
    console.log('📝 Added timestamp to filename:', timestamp)
  }

  // Add the appropriate file extension
  newFilename = `${newFilename}${fileExtension}`

  // Sanitize filename to remove invalid characters
  newFilename = sanitizeFilename(newFilename)

  console.log('📝 Original filename:', contextData.originalPdfFilename || contextData.pdfFilename)
  console.log('📝 New filename:', newFilename)
  console.log('📝 File extension:', fileExtension)

  return {
    success: true,
    originalFilename: contextData.originalPdfFilename || contextData.pdfFilename,
    newFilename,
    contextUpdate: {
      renamedFilename: newFilename
    }
  }
}

function generateTimestamp(format: string): string {
  const now = new Date()

  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  const hours = String(now.getUTCHours()).padStart(2, '0')
  const minutes = String(now.getUTCMinutes()).padStart(2, '0')
  const seconds = String(now.getUTCSeconds()).padStart(2, '0')

  switch (format) {
    case 'YYYYMMDD':
      return `${year}${month}${day}`
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`
    case 'YYYYMMDD_HHMMSS':
      return `${year}${month}${day}_${hours}${minutes}${seconds}`
    case 'YYYY-MM-DD_HH-MM-SS':
      return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
    default:
      return `${year}${month}${day}`
  }
}

function sanitizeFilename(filename: string): string {
  // Remove invalid filename characters but keep valid ones like underscores, hyphens, and dots
  return filename.replace(/[/\\:*?"<>|]/g, '_')
}

async function extractSpecificPageFromPdf(pdfBase64: string, pageNumber: number): Promise<string> {
  console.log(`📄 === EXTRACTING PAGE ${pageNumber} FROM PDF ===`)

  try {
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0))
    console.log(`📄 Decoded PDF, size: ${pdfBytes.length} bytes`)

    const pdfDoc = await PDFDocument.load(pdfBytes)
    const totalPages = pdfDoc.getPageCount()
    console.log(`📄 PDF has ${totalPages} page(s)`)

    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new Error(`Invalid page number ${pageNumber}. PDF has ${totalPages} page(s). Page number must be between 1 and ${totalPages}.`)
    }

    const newPdf = await PDFDocument.create()
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1])
    newPdf.addPage(copiedPage)

    const newPdfBytes = await newPdf.save()
    console.log(`📄 Created new PDF with single page, size: ${newPdfBytes.length} bytes`)

    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < newPdfBytes.length; i += chunkSize) {
      const chunk = newPdfBytes.subarray(i, Math.min(i + chunkSize, newPdfBytes.length))
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    const newPdfBase64 = btoa(binary)
    console.log(`📄 ✅ Successfully extracted page ${pageNumber}/${totalPages}`)

    return newPdfBase64
  } catch (error) {
    console.error('📄 ❌ PDF extraction failed:', error)
    throw error
  }
}

async function executeSftpUpload(step: WorkflowStep, contextData: any, supabase: any, requestData: WorkflowExecutionRequest): Promise<any> {
  console.log('📤 === EXECUTING SFTP UPLOAD ===')
  console.log('📤 Step config:', JSON.stringify(step.config_json, null, 2))
  console.log('📤 Context data keys:', Object.keys(contextData))

  const config = step.config_json

  // Fetch SFTP configuration from database
  const { data: sftpConfig, error: sftpConfigError } = await supabase
    .from('sftp_config')
    .select('*')
    .single()

  if (sftpConfigError || !sftpConfig) {
    console.error('❌ Failed to fetch SFTP configuration:', sftpConfigError)
    throw new Error('SFTP configuration not found. Please configure SFTP settings first.')
  }

  console.log('✅ SFTP config loaded')
  console.log('📤 SFTP Host:', sftpConfig.host)
  console.log('📤 XML Path:', sftpConfig.xml_path)
  console.log('📤 PDF Path:', sftpConfig.pdf_path)
  console.log('📤 JSON Path:', sftpConfig.json_path)
  console.log('📤 CSV Path:', sftpConfig.csv_path || 'NOT CONFIGURED')

  // Determine format type from context
  const formatType = contextData.formatType || requestData.formatType || 'XML'
  console.log('📤 Format type:', formatType)

  // Validate required data
  if (!contextData.extractedData) {
    throw new Error('No extracted data available for SFTP upload')
  }

  if (!contextData.pdfBase64) {
    throw new Error('No PDF data available for SFTP upload')
  }

  // Determine filename
  let baseFilename = 'document'

  // Check for renamed filename from previous step
  if (contextData.renamedFilename) {
    baseFilename = contextData.renamedFilename.replace(/\.(pdf|csv|json|xml)$/i, '')
    console.log('📤 Using renamed filename from previous step:', baseFilename)
  } else if (config.useApiResponseForFilename && config.filenameSourcePath) {
    // Try to get filename from API response or extracted data
    const customFilename = extractValueFromJsonPath(contextData, config.filenameSourcePath)
    if (customFilename) {
      baseFilename = String(customFilename)
      console.log('📤 Using custom filename from API response:', baseFilename)
    } else if (config.fallbackFilename) {
      baseFilename = config.fallbackFilename
      console.log('📤 Using fallback filename:', baseFilename)
    }
  } else if (config.fallbackFilename) {
    baseFilename = config.fallbackFilename
    console.log('📤 Using configured fallback filename:', baseFilename)
  } else if (contextData.pdfFilename) {
    baseFilename = contextData.pdfFilename.replace(/\.pdf$/i, '')
    console.log('📤 Using PDF filename from context:', baseFilename)
  }

  // Build SFTP upload request
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing for SFTP upload')
  }

  const uploadRequest: any = {
    sftpConfig: {
      host: sftpConfig.host,
      port: sftpConfig.port,
      username: sftpConfig.username,
      password: sftpConfig.password,
      xmlPath: config.sftpPathOverride || sftpConfig.xml_path,
      pdfPath: config.sftpPathOverride || sftpConfig.pdf_path,
      jsonPath: config.sftpPathOverride || sftpConfig.json_path,
      csvPath: config.sftpPathOverride || sftpConfig.csv_path
    },
    xmlContent: contextData.extractedData,
    pdfBase64: contextData.pdfBase64,
    baseFilename: baseFilename,
    originalFilename: contextData.originalPdfFilename || requestData.originalPdfFilename,
    formatType: formatType,
    exactFilename: contextData.renamedFilename,
    pdfUploadStrategy: config.pdfUploadStrategy || 'all_pages_in_group',
    specificPageToUpload: config.specificPageToUpload,
    uploadFileTypes: config.uploadFileTypes || { json: true, pdf: true, xml: true, csv: true }
  }

  console.log('📤 Calling SFTP upload function...')
  console.log('📤 Base filename:', uploadRequest.baseFilename)
  console.log('📤 Format type:', uploadRequest.formatType)
  console.log('📤 PDF upload strategy:', uploadRequest.pdfUploadStrategy)
  console.log('📤 Upload file types:', uploadRequest.uploadFileTypes)

  const sftpUploadUrl = `${supabaseUrl}/functions/v1/sftp-upload`
  const response = await fetch(sftpUploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(uploadRequest)
  })

  console.log('📤 SFTP upload response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('📤 ❌ SFTP upload failed:', errorText)
    throw new Error(`SFTP upload failed: ${errorText}`)
  }

  const uploadResult = await response.json()
  console.log('📤 ✅ SFTP UPLOAD SUCCESSFUL')
  console.log('📤 Upload result:', uploadResult)

  return {
    success: true,
    uploadResult: uploadResult,
    message: 'SFTP upload completed successfully'
  }
}

function extractValueFromJsonPath(data: any, path: string): any {
  if (!path) return null

  const parts = path.split('.')
  let current = data

  for (const part of parts) {
    if (current === null || current === undefined) return null

    // Handle array indexing like "orders[0]" or "orders.0"
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
    if (arrayMatch) {
      const arrayName = arrayMatch[1]
      const index = parseInt(arrayMatch[2])
      current = current[arrayName]?.[index]
    } else {
      current = current[part]
    }
  }

  return current
}

function replaceTemplateVariables(template: string, contextData: any): string {
  if (!template) return ''

  console.log('🔧 === TEMPLATE VARIABLE REPLACEMENT START ===')
  console.log('🔧 Template:', template)
  console.log('🔧 Context data keys:', Object.keys(contextData))

  let result = template

  let extractedData: any = {}

  if (contextData.extractedData) {
    console.log('🔧 Raw extractedData type:', typeof contextData.extractedData)

    if (typeof contextData.extractedData === 'string') {
      console.log('🔧 Parsing extractedData string, length:', contextData.extractedData.length)
      console.log('🔧 extractedData preview:', contextData.extractedData.substring(0, 200))
      try {
        extractedData = JSON.parse(contextData.extractedData)
        console.log('🔧 ✅ Successfully parsed extractedData')
        console.log('🔧 Parsed extractedData keys:', Object.keys(extractedData))
        console.log('🔧 Parsed extractedData:', extractedData)
      } catch (e) {
        console.error('🔧 ❌ Failed to parse extractedData:', e)
        extractedData = {}
      }
    } else {
      extractedData = contextData.extractedData
      console.log('🔧 Using extractedData object directly')
      console.log('🔧 extractedData keys:', Object.keys(extractedData))
      console.log('🔧 extractedData:', extractedData)
    }
  } else {
    console.log('🔧 ⚠️  No extractedData found in contextData')
  }

  const allData = {
    ...contextData,
    ...extractedData
  }

  if (contextData.renamedFilename && !allData.renamedFilename) {
    allData.renamedFilename = contextData.renamedFilename
  }

  if (contextData.pdfFilename && !allData.pdfFilename) {
    allData.pdfFilename = contextData.pdfFilename
  }

  console.log('🔧 All available fields for replacement:', Object.keys(allData))
  console.log('🔧 All data sample (first 5 fields):')
  Object.entries(allData).slice(0, 5).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 100) {
      console.log(`  - ${key}: [long string, length ${value.length}]`)
    } else if (typeof value === 'object') {
      console.log(`  - ${key}: [object]`)
    } else {
      console.log(`  - ${key}:`, value)
    }
  })

  const regex = /\{\{(\w+)\}\}/g
  const matches = template.match(regex)
  console.log('🔧 Template variables to replace:', matches || 'none')

  result = result.replace(regex, (match, fieldName) => {
    console.log(`🔧 Looking for field: ${fieldName}`)
    const value = allData[fieldName]
    if (value !== undefined && value !== null) {
      console.log(`🔧 ✅ Found {{${fieldName}}}, replacing with:`, value)
      return String(value)
    }
    console.warn(`🔧 ❌ Template variable {{${fieldName}}} not found in available data`)
    console.warn(`🔧    Available fields: ${Object.keys(allData).join(', ')}`)
    return match
  })

  console.log('🔧 Final result after replacement:', result)
  console.log('🔧 === TEMPLATE VARIABLE REPLACEMENT END ===')

  return result
}
