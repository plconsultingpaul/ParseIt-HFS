import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface TestEmailRequest {
  provider: 'office365' | 'gmail'
  // Office 365 fields
  tenantId?: string
  clientId?: string
  clientSecret?: string
  defaultSendFromEmail?: string
  // Gmail fields
  gmailClientId?: string
  gmailClientSecret?: string
  gmailRefreshToken?: string
  // Test email details
  testToEmail: string
  testSubject: string
  testBody: string
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  console.log('📧 === TEST EMAIL SEND START ===')
  
  try {
    const requestData: TestEmailRequest = await req.json()
    const { provider, testToEmail, testSubject, testBody } = requestData

    console.log('📧 Test email request received:')
    console.log('📧 Provider:', provider)
    console.log('📧 To:', testToEmail)
    console.log('📧 Subject:', testSubject)
    console.log('📧 Body preview:', testBody.substring(0, 100) + '...')

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(testToEmail)) {
      throw new Error(`Invalid recipient email address: ${testToEmail}`)
    }

    if (provider === 'office365') {
      return await sendTestEmailOffice365(requestData)
    } else if (provider === 'gmail') {
      return await sendTestEmailGmail(requestData)
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid provider specified" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

  } catch (error) {
    console.error("📧 ❌ Test email send error:", error)
    
    return new Response(
      JSON.stringify({ 
        error: "Test email send failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

async function sendTestEmailOffice365(requestData: TestEmailRequest): Promise<Response> {
  const { tenantId, clientId, clientSecret, defaultSendFromEmail, testToEmail, testSubject, testBody } = requestData

  console.log('📧 === OFFICE 365 TEST EMAIL START ===')
  console.log('📧 Tenant ID:', tenantId ? 'configured' : 'missing')
  console.log('📧 Client ID:', clientId ? 'configured' : 'missing')
  console.log('📧 Client Secret:', clientSecret ? 'configured' : 'missing')
  console.log('📧 Default Send From Email:', defaultSendFromEmail || 'not configured')

  // Validate required fields
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing required Office 365 fields: Tenant ID, Client ID, or Client Secret")
  }

  if (!defaultSendFromEmail) {
    throw new Error("Default Send From Email is required for sending test emails")
  }

  // Validate sender email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(defaultSendFromEmail)) {
    throw new Error(`Invalid sender email address: ${defaultSendFromEmail}`)
  }

  console.log('📧 Using From address:', defaultSendFromEmail)
  console.log('📧 Sending to:', testToEmail)

  // Step 1: Get access token from Microsoft Graph
  console.log('📧 🔑 Requesting Office 365 access token...')
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  })

  console.log('📧 Token request URL:', tokenUrl)
  console.log('📧 Token request params:', {
    client_id: clientId,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
    client_secret: clientSecret ? 'configured' : 'missing'
  })

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams
  })

  console.log('📧 Token response status:', tokenResponse.status)
  const tokenData = await tokenResponse.json()
  console.log('📧 Token response data keys:', Object.keys(tokenData))

  if (!tokenResponse.ok) {
    console.error('📧 ❌ Token request failed:', tokenData)
    throw new Error(`Failed to get Office 365 access token: ${tokenData.error_description || tokenData.error}`)
  }

  console.log('📧 ✅ Office 365 access token acquired successfully')
  console.log('📧 Token type:', tokenData.token_type)
  console.log('📧 Token expires in:', tokenData.expires_in, 'seconds')

  // Step 2: Prepare email message for Microsoft Graph
  const emailMessage = {
    message: {
      subject: testSubject,
      body: {
        contentType: 'Text',
        content: testBody
      },
      toRecipients: [
        {
          emailAddress: {
            address: testToEmail
          }
        }
      ],
      from: {
        emailAddress: {
          address: defaultSendFromEmail
        }
      }
    }
  }

  console.log('📧 📝 Email message structure being sent to Microsoft Graph:')
  console.log('📧 Complete message object:', JSON.stringify(emailMessage, null, 2))
  console.log('📧 From address in message:', emailMessage.message.from.emailAddress.address)
  console.log('📧 To address in message:', emailMessage.message.toRecipients[0].emailAddress.address)
  console.log('📧 Subject in message:', emailMessage.message.subject)
  console.log('📧 Body content type:', emailMessage.message.body.contentType)
  console.log('📧 Body content preview:', emailMessage.message.body.content.substring(0, 100) + '...')

  // Step 3: Send email via Microsoft Graph API
  const graphUrl = `https://graph.microsoft.com/v1.0/users/${defaultSendFromEmail}/sendMail`
  console.log('📧 🚀 Microsoft Graph API URL:', graphUrl)
  console.log('📧 Using authorization token:', tokenData.access_token ? 'present' : 'missing')

  const graphResponse = await fetch(graphUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailMessage)
  })

  console.log('📧 📤 Microsoft Graph API response status:', graphResponse.status)
  console.log('📧 Microsoft Graph API response ok:', graphResponse.ok)
  console.log('📧 Microsoft Graph API response headers:', Object.fromEntries(graphResponse.headers.entries()))

  const graphResponseText = await graphResponse.text()
  console.log('📧 Microsoft Graph API response body:', graphResponseText)

  if (!graphResponse.ok) {
    console.error('📧 ❌ Microsoft Graph API error:', graphResponseText)
    
    let errorDetails = graphResponseText
    try {
      const errorData = JSON.parse(graphResponseText)
      errorDetails = errorData.error?.message || errorData.error_description || graphResponseText
    } catch (parseError) {
      // Use raw response if JSON parsing fails
    }
    
    throw new Error(`Microsoft Graph API error (${graphResponse.status}): ${errorDetails}`)
  }

  console.log('📧 ✅ TEST EMAIL SENT SUCCESSFULLY via Office 365')
  console.log('📧 Email sent from:', defaultSendFromEmail)
  console.log('📧 Email sent to:', testToEmail)
  console.log('📧 Email subject:', testSubject)

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: `Test email sent successfully from ${defaultSendFromEmail} to ${testToEmail}`,
      provider: 'office365',
      fromAddress: defaultSendFromEmail,
      toAddress: testToEmail,
      subject: testSubject,
      timestamp: new Date().toISOString(),
      graphApiStatus: graphResponse.status
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  )
}

async function sendTestEmailGmail(requestData: TestEmailRequest): Promise<Response> {
  const { gmailClientId, gmailClientSecret, gmailRefreshToken, defaultSendFromEmail, testToEmail, testSubject, testBody } = requestData

  console.log('📧 === GMAIL TEST EMAIL START ===')
  console.log('📧 Gmail client ID:', gmailClientId ? 'configured' : 'missing')
  console.log('📧 Gmail refresh token:', gmailRefreshToken ? 'configured' : 'missing')
  console.log('📧 Default Send From Email:', defaultSendFromEmail || 'not configured')

  // Validate required fields
  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
    throw new Error("Missing required Gmail fields: Client ID, Client Secret, or Refresh Token")
  }

  if (!defaultSendFromEmail) {
    throw new Error("Default Send From Email is required for sending test emails")
  }

  // Validate sender email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(defaultSendFromEmail)) {
    throw new Error(`Invalid sender email address: ${defaultSendFromEmail}`)
  }

  console.log('📧 Using From address:', defaultSendFromEmail)
  console.log('📧 Sending to:', testToEmail)

  // Step 1: Refresh Gmail access token
  console.log('📧 🔑 Refreshing Gmail access token...')
  const tokenUrl = 'https://oauth2.googleapis.com/token'
  
  const tokenParams = new URLSearchParams({
    client_id: gmailClientId,
    client_secret: gmailClientSecret,
    refresh_token: gmailRefreshToken,
    grant_type: 'refresh_token'
  })

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams
  })

  const tokenData = await tokenResponse.json()
  console.log('📧 Gmail token response status:', tokenResponse.status)

  if (!tokenResponse.ok) {
    console.error('📧 ❌ Gmail token request failed:', tokenData)
    throw new Error(`Failed to refresh Gmail access token: ${tokenData.error_description || tokenData.error}`)
  }

  console.log('📧 ✅ Gmail access token refreshed successfully')

  // Step 2: Create email message for Gmail API
  const emailLines = [
    `To: ${testToEmail}`,
    `From: ${defaultSendFromEmail}`,
    `Subject: ${testSubject}`,
    '',
    testBody
  ]
  const emailMessage = emailLines.join('\r\n')
  const encodedMessage = btoa(emailMessage).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  console.log('📧 📝 Gmail email message created:')
  console.log('📧 From address:', defaultSendFromEmail)
  console.log('📧 To address:', testToEmail)
  console.log('📧 Subject:', testSubject)
  console.log('📧 Body preview:', testBody.substring(0, 100) + '...')
  console.log('📧 Encoded message length:', encodedMessage.length)

  // Step 3: Send email via Gmail API
  const gmailUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
  console.log('📧 🚀 Gmail API URL:', gmailUrl)

  const gmailResponse = await fetch(gmailUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: encodedMessage
    })
  })

  console.log('📧 📤 Gmail API response status:', gmailResponse.status)
  const gmailResponseData = await gmailResponse.json()
  console.log('📧 Gmail API response:', gmailResponseData)

  if (!gmailResponse.ok) {
    console.error('📧 ❌ Gmail API error:', gmailResponseData)
    throw new Error(`Gmail API error (${gmailResponse.status}): ${JSON.stringify(gmailResponseData)}`)
  }

  console.log('📧 ✅ TEST EMAIL SENT SUCCESSFULLY via Gmail')
  console.log('📧 Email sent from:', defaultSendFromEmail)
  console.log('📧 Email sent to:', testToEmail)
  console.log('📧 Gmail message ID:', gmailResponseData.id)

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: `Test email sent successfully from ${defaultSendFromEmail} to ${testToEmail}`,
      provider: 'gmail',
      fromAddress: defaultSendFromEmail,
      toAddress: testToEmail,
      subject: testSubject,
      timestamp: new Date().toISOString(),
      gmailMessageId: gmailResponseData.id
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  )
}