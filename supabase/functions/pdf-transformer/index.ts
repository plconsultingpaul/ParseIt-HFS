import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface TransformationRequest {
  pdfBase64: string
  transformationType: {
    id: string
    name: string
    defaultInstructions: string
    filenameTemplate: string
    fieldMappings?: Array<{
      fieldName: string
      type: 'ai' | 'mapped' | 'hardcoded'
      value: string
      dataType?: 'string' | 'number' | 'integer' | 'datetime'
      maxLength?: number
    }>
  }
  additionalInstructions?: string
  apiKey: string
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  console.log('=== PDF TRANSFORMER START ===');
  
  try {
    let requestText: string;
    try {
      requestText = await req.text();
    } catch (readError) {
      console.error('Failed to read request body:', readError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to read request body", 
          details: readError instanceof Error ? readError.message : "Unknown error"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log('Request body size:', requestText.length, 'characters');
    console.log('Request body preview (first 200 chars):', requestText.substring(0, 200));
    console.log('Request body preview (last 200 chars):', requestText.substring(Math.max(0, requestText.length - 200)));
    
    let requestData: TransformationRequest;
    try {
      requestData = JSON.parse(requestText);
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError);
      console.log('Invalid JSON content:', requestText);
      return new Response(
        JSON.stringify({ 
          error: "Invalid JSON in request body", 
          details: parseError instanceof Error ? parseError.message : "Unknown parse error"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const { pdfBase64, transformationType, additionalInstructions, apiKey } = requestData;
    
    console.log('PDF base64 length:', pdfBase64?.length || 0);
    console.log('Transformation type:', transformationType?.name);
    console.log('API key present:', !!apiKey);

    if (!apiKey) {
      throw new Error('Google Gemini API key not configured')
    }

    if (!transformationType) {
      throw new Error('Transformation type not provided')
    }

    console.log('Initializing Gemini AI...');
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' })

    // Combine instructions
    const fullInstructions = additionalInstructions 
      ? `${transformationType.defaultInstructions}\n\nAdditional Instructions: ${additionalInstructions}`
      : transformationType.defaultInstructions

    console.log('Full instructions length:', fullInstructions.length);
    // Build field mapping instructions
    let fieldMappingInstructions = ''
    if (transformationType.fieldMappings && transformationType.fieldMappings.length > 0) {
      console.log('Processing field mappings:', transformationType.fieldMappings.length);
      fieldMappingInstructions = '\n\nFIELD EXTRACTION INSTRUCTIONS:\n'
      transformationType.fieldMappings.forEach(mapping => {
        // Add page-specific instruction if pageNumberInGroup is specified
        const pageInstruction = mapping.pageNumberInGroup && mapping.pageNumberInGroup > 1 
          ? ` (extract from page ${mapping.pageNumberInGroup} of the provided PDF)` 
          : '';
          
        if (mapping.type === 'hardcoded') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (as string with exact case)' : 
                              mapping.dataType === 'number' ? ' (format as number)' : 
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? ' (as datetime string in yyyy-MM-ddThh:mm:ss format)' : ''
          fieldMappingInstructions += `- "${mapping.fieldName}": Always use the EXACT hardcoded value "${mapping.value}" with precise case preservation${dataTypeNote}${pageInstruction}\n`
        } else if (mapping.type === 'mapped') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as string)' : 
                              mapping.dataType === 'number' ? ' (format as number)' : 
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? ' (format as datetime in yyyy-MM-ddThh:mm:ss format)' : ''
          fieldMappingInstructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}${pageInstruction}\n`
        } else {
          // AI type
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as string)' : 
                              mapping.dataType === 'number' ? ' (format as number)' : 
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? ' (format as datetime in yyyy-MM-ddThh:mm:ss format)' : ''
          fieldMappingInstructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}${pageInstruction}\n`
        }
      })
    }

    console.log('Field mapping instructions length:', fieldMappingInstructions.length);
    
    const prompt = `
You are a data extraction AI for PDF transformation and renaming. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}${fieldMappingInstructions}

OUTPUT FORMAT:
Please format the extracted data as JSON with the following structure:
{
  "extractedData": {
    // Include all the fields needed for the filename template
  }
}

IMPORTANT GUIDELINES:
1. Only extract information that is clearly visible in the document
2. If a field is not found, use empty string ("") for text fields, 0 for numbers, null for optional fields
3. For datetime fields, use the format yyyy-MM-ddThh:mm:ss (e.g., "2024-03-15T14:30:00")
4. Be precise and accurate with the extracted data
5. The extracted data will be used to rename the PDF file using the template: ${transformationType.filenameTemplate}
6. Ensure all field names match exactly what's needed for the filename template

Please provide only the JSON output without any additional explanation or formatting.
`

    console.log('Prompt length:', prompt.length);
    console.log('Calling Gemini AI...');
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64
        }
      },
      prompt
    ])

    const response = await result.response
    let extractedContent = response.text()
    
    console.log('=== AI RESPONSE ANALYSIS ===')
    console.log('Raw AI response length:', extractedContent.length)
    console.log('Raw AI response preview (first 500 chars):', extractedContent.substring(0, 500))
    console.log('Raw AI response preview (last 200 chars):', extractedContent.substring(Math.max(0, extractedContent.length - 200)))

    // Clean up the response - remove any markdown formatting
    extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    console.log('Cleaned AI response length:', extractedContent.length)
    console.log('Cleaned AI response preview (first 500 chars):', extractedContent.substring(0, 500))

    // Parse the extracted data
    console.log('=== PARSING EXTRACTED DATA ===')
    let extractedData: any
    try {
      console.log('Attempting to parse AI response as JSON...')
      
      // Validate that we have some content to parse
      if (!extractedContent || extractedContent.trim() === '') {
        console.error('AI response is empty after cleaning')
        throw new Error('AI returned empty response')
      }
      
      // Check if the response looks like it might be truncated
      const trimmed = extractedContent.trim()
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        console.error('AI response does not start with valid JSON character')
        console.log('Response starts with:', trimmed.substring(0, 50))
        throw new Error('AI response does not appear to be JSON')
      }
      
      if (!trimmed.endsWith('}') && !trimmed.endsWith(']')) {
        console.error('AI response does not end with valid JSON character - may be truncated')
        console.log('Response ends with:', trimmed.substring(Math.max(0, trimmed.length - 50)))
        throw new Error('AI response appears to be truncated')
      }
      
      const parsedResponse = JSON.parse(extractedContent)
      console.log('Successfully parsed AI response');
      console.log('Parsed response structure:', Object.keys(parsedResponse))
      extractedData = parsedResponse.extractedData || parsedResponse || {}
      
      // Ensure extractedData is always a valid object
      if (typeof extractedData !== 'object' || extractedData === null || Array.isArray(extractedData)) {
        console.warn('Invalid extracted data format, using fallback object')
        console.log('Invalid data type:', typeof extractedData)
        console.log('Invalid data value:', extractedData)
        extractedData = {}
      }
      
      // Ensure we have at least some basic data structure
      if (Object.keys(extractedData).length === 0) {
        console.warn('Extracted data is empty, creating fallback structure')
        extractedData = {
          documentType: 'unknown',
          extractionFailed: true,
          originalFilename: 'unknown',
          extractedAt: new Date().toISOString()
        }
      }
      
    } catch (parseError) {
      console.error('=== CRITICAL JSON PARSE ERROR ===')
      console.error('Parse error type:', parseError.constructor.name)
      console.error('Parse error message:', parseError.message)
      console.log('Failed to parse content length:', extractedContent.length)
      console.log('Failed to parse content (full):', extractedContent)
      console.log('Content character codes (first 20):', extractedContent.substring(0, 20).split('').map(c => c.charCodeAt(0)))
      
      // Create a valid fallback structure
      extractedData = {
        documentType: 'unknown',
        extractionFailed: true,
        parseError: parseError.message,
        originalFilename: 'unknown',
        extractedAt: new Date().toISOString(),
        rawAiResponse: extractedContent.substring(0, 1000) // Include first 1000 chars for debugging
      }
      console.log('Created fallback extracted data structure')
    }

    console.log('=== FINAL EXTRACTED DATA VALIDATION ===')
    console.log('Final extracted data keys:', Object.keys(extractedData))
    console.log('Final extracted data:', extractedData)
    
    // Validate that the final extracted data can be serialized to JSON
    let finalJsonString: string
    try {
      finalJsonString = JSON.stringify(extractedData)
      console.log('Final JSON serialization successful, length:', finalJsonString.length)
      console.log('Final JSON preview (first 200 chars):', finalJsonString.substring(0, 200))
    } catch (serializeError) {
      console.error('CRITICAL: Cannot serialize extracted data to JSON:', serializeError)
      // Create an even simpler fallback
      extractedData = {
        error: 'Serialization failed',
        message: serializeError.message,
        timestamp: new Date().toISOString()
      }
      finalJsonString = JSON.stringify(extractedData)
      console.log('Created minimal fallback JSON:', finalJsonString)
    }
    
    // Generate new filename using the template
    let newFilename = transformationType.filenameTemplate
    console.log('=== FILENAME GENERATION ===')
    console.log('Original filename template:', newFilename)
    
    // Replace placeholders in filename template with extracted data
    for (const [key, value] of Object.entries(extractedData)) {
      const placeholder = `{{${key}}}`
      if (newFilename.includes(placeholder)) {
        // Clean the value for filename use (remove invalid characters)
        const cleanValue = String(value || '').replace(/[<>:"/\\|?*]/g, '_').trim()
        console.log(`Replacing ${placeholder} with ${cleanValue}`);
        newFilename = newFilename.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), cleanValue)
      }
    }

    // Ensure the filename ends with .pdf
    if (!newFilename.toLowerCase().endsWith('.pdf')) {
      newFilename += '.pdf'
    }

    // Remove any remaining unreplaced placeholders
    newFilename = newFilename.replace(/\{\{[^}]+\}\}/g, 'MISSING')
    
    console.log('Final generated filename:', newFilename);

    console.log('=== PDF TRANSFORMER SUCCESS ===')
    console.log('Returning extracted data size:', JSON.stringify(extractedData).length, 'characters')
    
    const responseData = {
        success: true,
        extractedData: extractedData,
        newFilename: newFilename,
        message: 'PDF transformation completed successfully'
    };
    
    // Validate response can be serialized
    let responseJson: string;
    try {
      responseJson = JSON.stringify(responseData);
      console.log('Response JSON validation successful, length:', responseJson.length);
    } catch (serializeError) {
      console.error('CRITICAL: Cannot serialize response to JSON:', serializeError);
      return new Response(
        JSON.stringify({ 
          error: "Response serialization failed", 
          details: serializeError instanceof Error ? serializeError.message : "Unknown serialization error"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    return new Response(
      responseJson,
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("PDF transformation error:", error)
    console.log('=== PDF TRANSFORMER ERROR ===');
    
    // Provide more detailed error information
    let errorDetails = "Unknown error";
    if (error instanceof Error) {
      errorDetails = error.message;
      
      // Check for specific error types and provide better messages
      if (error.message.includes("Unexpected end of JSON input")) {
        errorDetails = "The AI returned invalid or incomplete JSON data. This usually happens when the PDF content is unclear or the extraction instructions need to be more specific. Please try with a clearer PDF or adjust your transformation instructions.";
      } else if (error.message.includes("JSON.parse")) {
        errorDetails = "The AI returned data that couldn't be processed as valid JSON. Please check your transformation instructions and try again with a clearer PDF document.";
      } else if (error.message.includes("API key")) {
        errorDetails = "Google Gemini API key is missing or invalid. Please check your API configuration in Settings.";
      } else if (error.message.includes("quota") || error.message.includes("rate limit")) {
        errorDetails = "API rate limit exceeded. Please wait a moment and try again.";
      } else if (error.message.includes("overloaded") || error.message.includes("503")) {
        errorDetails = "The AI service is temporarily overloaded. Please wait a moment and try again.";
      }
    }
    
    const errorResponse = { 
      error: "PDF transformation failed", 
      details: errorDetails
    };
    
    return new Response(
      JSON.stringify(errorResponse),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})