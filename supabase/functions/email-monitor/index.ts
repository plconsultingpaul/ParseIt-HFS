import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface EmailMonitoringConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  monitoredEmail: string
  pollingInterval: number
  isEnabled: boolean
  lastCheck?: string
}

interface EmailProcessingRule {
  id: string
  ruleName: string
  senderPattern: string
  subjectPattern: string
  extractionTypeId: string
  isEnabled: boolean
  priority: number
}

interface ExtractionType {
  id: string
  name: string
  defaultInstructions: string
  xmlFormat: string
  filename: string
  formatType: string
  jsonPath?: string
  fieldMappings?: any[]
}

interface EmailAttachment {
  id: string
  name: string
  contentType: string
  size: number
  contentBytes?: string
}

interface EmailMessage {
  id: string
  subject: string
  from: { emailAddress: { address: string, name: string } }
  receivedDateTime: string
  hasAttachments: boolean
  attachments?: EmailAttachment[]
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    // Get email monitoring configuration
    const configResponse = await fetch(`${supabaseUrl}/rest/v1/email_monitoring_config?select=*&order=updated_at.desc&limit=1`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    if (!configResponse.ok) {
      throw new Error('Failed to get email monitoring config')
    }

    const configData = await configResponse.json()
    if (!configData || configData.length === 0) {
      return new Response(
        JSON.stringify({ message: "No email monitoring configuration found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const config: EmailMonitoringConfig = {
      tenantId: configData[0].tenant_id,
      clientId: configData[0].client_id,
      clientSecret: configData[0].client_secret,
      monitoredEmail: configData[0].monitored_email,
      pollingInterval: configData[0].polling_interval,
      isEnabled: configData[0].is_enabled,
      lastCheck: configData[0].last_check
    }

    if (!config.isEnabled) {
      return new Response(
        JSON.stringify({ message: "Email monitoring is disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get processing rules
    const rulesResponse = await fetch(`${supabaseUrl}/rest/v1/email_processing_rules?select=*&is_enabled=eq.true&order=priority.asc`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    if (!rulesResponse.ok) {
      throw new Error('Failed to get processing rules')
    }

    const rulesData = await rulesResponse.json()
    const rules: EmailProcessingRule[] = rulesData.map((rule: any) => ({
      id: rule.id,
      ruleName: rule.rule_name,
      senderPattern: rule.sender_pattern,
      subjectPattern: rule.subject_pattern,
      extractionTypeId: rule.extraction_type_id,
      isEnabled: rule.is_enabled,
      priority: rule.priority
    }))

    // Get extraction types
    const extractionTypesResponse = await fetch(`${supabaseUrl}/rest/v1/extraction_types?select=*`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    if (!extractionTypesResponse.ok) {
      throw new Error('Failed to get extraction types')
    }

    const extractionTypesData = await extractionTypesResponse.json()
    const extractionTypes: ExtractionType[] = extractionTypesData.map((type: any) => ({
      id: type.id,
      name: type.name,
      defaultInstructions: type.default_instructions,
      xmlFormat: type.xml_format,
      filename: type.filename,
      formatType: type.format_type || 'XML',
      jsonPath: type.json_path,
      fieldMappings: type.field_mappings ? JSON.parse(type.field_mappings) : []
    }))

    // Get access token from Microsoft Graph
    const accessToken = await getAccessToken(config)

    // Calculate the time to check from (last check or 1 hour ago)
    const lastCheckTime = config.lastCheck ? new Date(config.lastCheck) : new Date(Date.now() - 60 * 60 * 1000)
    const filterTime = lastCheckTime.toISOString()

    // Get new emails since last check
    const emails = await getNewEmails(accessToken, config.monitoredEmail, filterTime)
    
    let processedCount = 0
    const results = []

    for (const email of emails) {
      try {
        // Check if email was already processed
        const existingEmailResponse = await fetch(`${supabaseUrl}/rest/v1/processed_emails?email_id=eq.${email.id}`, {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          }
        })

        if (existingEmailResponse.ok) {
          const existingEmails = await existingEmailResponse.json()
          if (existingEmails && existingEmails.length > 0) {
            continue // Skip already processed emails
          }
        }

        // Find matching rule
        const matchingRule = findMatchingRule(email, rules)
        if (!matchingRule) {
          continue // No matching rule found
        }

        // Get extraction type
        const extractionType = extractionTypes.find(type => type.id === matchingRule.extractionTypeId)
        if (!extractionType) {
          continue // Extraction type not found
        }

        // Get PDF attachments
        const pdfAttachments = await getPdfAttachments(accessToken, config.monitoredEmail, email.id)
        if (pdfAttachments.length === 0) {
          continue // No PDF attachments found
        }

        // Process each PDF attachment
        for (const attachment of pdfAttachments) {
          try {
            // Record the email as being processed
            await recordProcessedEmail(supabaseUrl, supabaseServiceKey, {
              emailId: email.id,
              sender: email.from.emailAddress.address,
              subject: email.subject,
              receivedDate: email.receivedDateTime,
              processingRuleId: matchingRule.id,
              extractionTypeId: extractionType.id,
              pdfFilename: attachment.name,
              processingStatus: 'processing'
            })

            // Only process XML format types for SFTP upload
            if (extractionType.formatType === 'XML') {
              await processEmailAttachment(
                supabaseUrl,
                supabaseServiceKey,
                email,
                attachment,
                extractionType,
                matchingRule
              )
              processedCount++
              results.push({
                emailId: email.id,
                subject: email.subject,
                attachment: attachment.name,
                extractionType: extractionType.name,
                status: 'processed'
              })
            } else {
              // Update status to completed for non-XML types (they don't get SFTP upload)
              await updateProcessedEmailStatus(supabaseUrl, supabaseServiceKey, email.id, 'completed', null)
              results.push({
                emailId: email.id,
                subject: email.subject,
                attachment: attachment.name,
                extractionType: extractionType.name,
                status: 'skipped - not XML format'
              })
            }
          } catch (attachmentError) {
            console.error('Error processing attachment:', attachmentError)
            await updateProcessedEmailStatus(
              supabaseUrl, 
              supabaseServiceKey, 
              email.id, 
              'failed', 
              attachmentError instanceof Error ? attachmentError.message : 'Unknown error'
            )

            // Move email to Archive folder after successful processing
            await moveEmailToArchive(accessToken, config.monitoredEmail, email.id)
            results.push({
              emailId: email.id,
              subject: email.subject,
              attachment: attachment.name,
              status: 'failed',
              error: attachmentError instanceof Error ? attachmentError.message : 'Unknown error'
            })
          }
        }
      } catch (emailError) {
        console.error('Error processing email:', emailError)
        results.push({
          emailId: email.id,
          subject: email.subject,
          status: 'failed',
          error: emailError instanceof Error ? emailError.message : 'Unknown error'
        })
      }
    }

    // Update last check time
    await fetch(`${supabaseUrl}/rest/v1/email_monitoring_config?id=eq.${configData[0].id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({
        last_check: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Email monitoring completed. Processed ${processedCount} emails.`,
        emailsChecked: emails.length,
        emailsProcessed: processedCount,
        results: results
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Email monitoring error:", error)
    
    return new Response(
      JSON.stringify({ 
        error: "Email monitoring failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

async function getAccessToken(config: EmailMonitoringConfig): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`
  
  const tokenParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString()
  })

  if (!tokenResponse.ok) {
    const tokenError = await tokenResponse.json()
    throw new Error(`Authentication failed: ${tokenError.error_description || tokenError.error}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

async function getNewEmails(accessToken: string, email: string, since: string): Promise<EmailMessage[]> {
  const messagesUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/messages?$filter=receivedDateTime ge ${since} and hasAttachments eq true&$select=id,subject,from,receivedDateTime,hasAttachments&$orderby=receivedDateTime desc&$top=50`
  
  const response = await fetch(messagesUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get emails: ${error.error?.message || 'Unknown error'}`)
  }

  const data = await response.json()
  return data.value || []
}

async function getPdfAttachments(accessToken: string, email: string, messageId: string): Promise<EmailAttachment[]> {
  const attachmentsUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/messages/${messageId}/attachments?$select=id,name,contentType,size`
  
  const response = await fetch(attachmentsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    return []
  }

  const data = await response.json()
  const attachments = data.value || []
  
  // Filter for PDF attachments and get their content
  const pdfAttachments = []
  for (const attachment of attachments) {
    if (attachment.contentType === 'application/pdf' || attachment.name.toLowerCase().endsWith('.pdf')) {
      // Get attachment content
      const contentUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/messages/${messageId}/attachments/${attachment.id}/$value`
      
      const contentResponse = await fetch(contentUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (contentResponse.ok) {
        const contentBuffer = await contentResponse.arrayBuffer()
        const contentBytes = btoa(String.fromCharCode(...new Uint8Array(contentBuffer)))
        
        pdfAttachments.push({
          ...attachment,
          contentBytes
        })
      }
    }
  }
  
  return pdfAttachments
}

function findMatchingRule(email: EmailMessage, rules: EmailProcessingRule[]): EmailProcessingRule | null {
  for (const rule of rules) {
    if (!rule.isEnabled) continue

    const senderMatch = !rule.senderPattern || 
      email.from.emailAddress.address.toLowerCase().includes(rule.senderPattern.toLowerCase()) ||
      email.from.emailAddress.name?.toLowerCase().includes(rule.senderPattern.toLowerCase())

    const subjectMatch = !rule.subjectPattern || 
      email.subject.toLowerCase().includes(rule.subjectPattern.toLowerCase())

    if (senderMatch && subjectMatch) {
      return rule
    }
  }
  
  return null
}

async function processEmailAttachment(
  supabaseUrl: string,
  supabaseServiceKey: string,
  email: EmailMessage,
  attachment: EmailAttachment,
  extractionType: ExtractionType,
  rule: EmailProcessingRule
) {
  try {
    // Get API settings for Gemini API key
    const apiSettingsResponse = await fetch(`${supabaseUrl}/rest/v1/api_settings?select=*&order=updated_at.desc&limit=1`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    let geminiApiKey = ''
    if (apiSettingsResponse.ok) {
      const apiSettingsData = await apiSettingsResponse.json()
      if (apiSettingsData && apiSettingsData.length > 0) {
        geminiApiKey = apiSettingsData[0].google_api_key || ''
      }
    }

    // Get settings config for fallback API key
    const settingsResponse = await fetch(`${supabaseUrl}/rest/v1/settings_config?select=*&order=updated_at.desc&limit=1`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    let fallbackApiKey = ''
    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json()
      if (settingsData && settingsData.length > 0) {
        fallbackApiKey = settingsData[0].gemini_api_key || ''
      }
    }

    const apiKey = geminiApiKey || fallbackApiKey
    if (!apiKey) {
      throw new Error('No Gemini API key configured')
    }

    // Extract data using Gemini AI
    const extractedXml = await extractDataWithGemini(
      attachment.contentBytes!,
      extractionType.defaultInstructions,
      extractionType.xmlFormat,
      apiKey
    )

    // Get SFTP configuration
    const sftpResponse = await fetch(`${supabaseUrl}/rest/v1/sftp_config?select=*&order=updated_at.desc&limit=1`, {
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      }
    })

    if (!sftpResponse.ok) {
      throw new Error('Failed to get SFTP configuration')
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
      pdfPath: sftpData[0].pdf_path
    }

    // Upload to SFTP
    const uploadResponse = await fetch(`${supabaseUrl}/functions/v1/sftp-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        sftpConfig,
        xmlContent: extractedXml,
        pdfBase64: attachment.contentBytes,
        baseFilename: extractionType.filename || 'document'
      })
    })

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json()
      throw new Error(errorData.details || errorData.error || 'SFTP upload failed')
    }

    const uploadResult = await uploadResponse.json()
    
    // Update processed email status
    await updateProcessedEmailStatus(
      supabaseUrl, 
      supabaseServiceKey, 
      email.id, 
      'completed', 
      null, 
      uploadResult.parseitId
    )

  } catch (error) {
    console.error('Error processing email attachment:', error)
    await updateProcessedEmailStatus(
      supabaseUrl, 
      supabaseServiceKey, 
      email.id, 
      'failed', 
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw error
  }
}

async function extractDataWithGemini(
  pdfBase64: string,
  instructions: string,
  xmlFormat: string,
  apiKey: string
): Promise<string> {
  const prompt = `
You are a data extraction AI. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${instructions}

OUTPUT FORMAT:
Please format the extracted data as XML following this XML template structure:
${xmlFormat}

IMPORTANT GUIDELINES:
1. Only extract information that is clearly visible in the document
2. If a field is not found, use "N/A" or leave it empty
3. Maintain the exact XML structure provided
4. Ensure all XML tags are properly closed
5. Use appropriate data types (dates, numbers, text)
6. Be precise and accurate with the extracted data

Please provide only the XML output without any additional explanation or formatting.
`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: pdfBase64
            }
          },
          {
            text: prompt
          }
        ]
      }]
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`)
  }

  const result = await response.json()
  let extractedContent = result.candidates?.[0]?.content?.parts?.[0]?.text || ''

  // Clean up the response - remove any markdown formatting
  extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim()

  if (!extractedContent.includes('<?xml') && !extractedContent.includes('<')) {
    throw new Error('Invalid XML response from AI')
  }

  return extractedContent
}

async function recordProcessedEmail(
  supabaseUrl: string,
  supabaseServiceKey: string,
  emailData: {
    emailId: string
    sender: string
    subject: string
    receivedDate: string
    processingRuleId: string
    extractionTypeId: string
    pdfFilename: string
    processingStatus: string
  }
) {
  await fetch(`${supabaseUrl}/rest/v1/processed_emails`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey
    },
    body: JSON.stringify({
      email_id: emailData.emailId,
      sender: emailData.sender,
      subject: emailData.subject,
      received_date: emailData.receivedDate,
      processing_rule_id: emailData.processingRuleId,
      extraction_type_id: emailData.extractionTypeId,
      pdf_filename: emailData.pdfFilename,
      processing_status: emailData.processingStatus,
      created_at: new Date().toISOString()
    })
  })
}

async function updateProcessedEmailStatus(
  supabaseUrl: string,
  supabaseServiceKey: string,
  emailId: string,
  status: string,
  errorMessage: string | null,
  parseitId?: number
) {
  const updateData: any = {
    processing_status: status,
    processed_at: new Date().toISOString()
  }

  if (errorMessage) {
    updateData.error_message = errorMessage
  }

  if (parseitId) {
    updateData.parseit_id = parseitId
  }

  await fetch(`${supabaseUrl}/rest/v1/processed_emails?email_id=eq.${emailId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey
    },
    body: JSON.stringify(updateData)
  })
}