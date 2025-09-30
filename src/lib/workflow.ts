import { supabase } from './supabase';

interface WorkflowExecutionRequest {
  extractedData: string;
  workflowId: string;
  userId?: string;
  extractionTypeId?: string;
  pdfFilename: string;
  pdfPages: number;
  pdfBase64: string;
  originalPdfFilename: string;
}

export async function executeWorkflow(request: WorkflowExecutionRequest): Promise<any> {
  console.log('executeWorkflow called with:', {
    workflowId: request.workflowId,
    userId: request.userId,
    extractionTypeId: request.extractionTypeId,
    pdfFilename: request.pdfFilename,
    dataLength: request.extractedData.length
  });
  
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase configuration missing');
  }

  // === DETAILED REQUEST DEBUGGING ===
  console.log('=== FRONTEND WORKFLOW REQUEST DEBUG ===');
  console.log('Request object keys:', Object.keys(request));
  console.log('Request object:', request);
  console.log('Extracted data length:', request.extractedData?.length || 0);
  console.log('Extracted data preview:', request.extractedData?.substring(0, 200));
  console.log('PDF base64 length:', request.pdfBase64?.length || 0);
  
  // Validate the request object before sending
  const requestString = JSON.stringify(request);
  console.log('Request JSON string length:', requestString.length);
  console.log('Request JSON preview (first 500 chars):', requestString.substring(0, 500));
  console.log('Request JSON preview (last 200 chars):', requestString.substring(Math.max(0, requestString.length - 200)));
  
  // Test if the request can be parsed back
  try {
    const testParse = JSON.parse(requestString);
    console.log('✅ Request JSON validation successful');
  } catch (validateError) {
    console.error('❌ CRITICAL: Request JSON is invalid before sending:', validateError);
    console.error('Invalid JSON content preview:', requestString.substring(0, 1000));
    throw new Error('Cannot send invalid JSON to workflow processor');
  }
  console.log('Making request to workflow processor...');
  
  const response = await fetch(`${supabaseUrl}/functions/v1/json-workflow-processor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(request)
  });

  console.log('Workflow processor response status:', response.status);
  console.log('Workflow processor response ok:', response.ok);
  console.log('Workflow processor response headers:', Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
      console.error('Workflow processor error response:', errorData);
    } catch (parseError) {
      console.error('Failed to parse error response:', parseError);
      const errorText = await response.text();
      console.error('Raw error response:', errorText);
      throw new Error(`Workflow execution failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const apiError: any = new Error(errorData.details || errorData.error || 'Workflow execution failed');
    apiError.workflowExecutionLogId = errorData.workflowExecutionLogId;
    apiError.extractionLogId = errorData.extractionLogId;
    throw apiError;
  }

  const result = await response.json();
  console.log('Workflow execution result:', result);
  return result;
}