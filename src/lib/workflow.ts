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