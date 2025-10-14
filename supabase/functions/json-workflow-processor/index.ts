import { Buffer } from "node:buffer"

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

Deno.serve(async (req: Request) => {
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