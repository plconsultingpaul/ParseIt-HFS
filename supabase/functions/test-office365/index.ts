import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface TestRequest {
  tenantId: string
  clientId: string
  clientSecret: string
  monitoredEmail: string
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const { tenantId, clientId, clientSecret, monitoredEmail }: TestRequest = await req.json()

    // Validate required fields
    if (!tenantId || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Step 1: Get access token from Microsoft Graph
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
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
    const accessToken = tokenData.access_token

    // Step 2: Test connection by getting user info or mailbox info
    let testUrl = 'https://graph.microsoft.com/v1.0/me'
    
    // If a specific email is provided, try to access that mailbox
    if (monitoredEmail && monitoredEmail.trim()) {
      // First try to get the user by email
      const userUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(monitoredEmail)}`
      
      const userResponse = await fetch(userUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (userResponse.ok) {
        // If user exists, try to access their mailbox
        testUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(monitoredEmail)}/messages?$top=1`
      }
    }

    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!testResponse.ok) {
      const testError = await testResponse.json()
      throw new Error(`API access failed: ${testError.error?.message || 'Unknown error'}`)
    }

    const testData = await testResponse.json()
    
    // Count emails if we're testing mailbox access
    let emailCount = 0
    if (testData.value && Array.isArray(testData.value)) {
      emailCount = testData.value.length
    }

    // Step 3: Test specific permissions by trying to access messages
    if (monitoredEmail) {
      const messagesUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(monitoredEmail)}/messages?$top=5&$select=id,subject,from,receivedDateTime,hasAttachments`
      
      const messagesResponse = await fetch(messagesUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        emailCount = messagesData.value ? messagesData.value.length : 0
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Connection successful",
        emailCount: emailCount,
        monitoredEmail: monitoredEmail || 'Current user'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )

  } catch (error) {
    console.error("Office 365 test error:", error)
    
    return new Response(
      JSON.stringify({ 
        error: "Connection test failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})