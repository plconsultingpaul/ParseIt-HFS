import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface DetectionRequest {
  pdfBase64: string
  extractionTypes: Array<{
    id: string
    name: string
    autoDetectInstructions: string
    formatType: string
  }>
  apiKey: string
}

interface DetectionResult {
  detectedTypeId: string | null
  confidence: 'high' | 'medium' | 'low' | null
  reasoning?: string
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const { pdfBase64, extractionTypes, apiKey }: DetectionRequest = await req.json()

    if (!apiKey) {
      throw new Error('Google Gemini API key not configured')
    }

    if (extractionTypes.length === 0) {
      throw new Error('No extraction types available for detection')
    }

    // Filter extraction types that have auto-detection instructions
    const detectableTypes = extractionTypes.filter(type => 
      type.autoDetectInstructions && type.autoDetectInstructions.trim()
    )

    if (detectableTypes.length === 0) {
      return new Response(
        JSON.stringify({
          detectedTypeId: null,
          confidence: null,
          reasoning: 'No extraction types have auto-detection instructions configured'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

    // Build the detection instructions for each extraction type
    const typeInstructions = detectableTypes
      .map(type => `
TYPE ID: ${type.id}
TYPE NAME: ${type.name}
DETECTION CRITERIA: ${type.autoDetectInstructions}
FORMAT: ${type.formatType}
---`)
      .join('\n')

    const prompt = `
You are a document classification AI. Your task is to analyze the provided PDF document and determine which extraction type should be used based on the document's content and structure.

AVAILABLE EXTRACTION TYPES:
${typeInstructions}

CLASSIFICATION INSTRUCTIONS:
1. Carefully analyze the PDF document's content, layout, structure, and any visible text
2. Compare the document characteristics against each extraction type's detection criteria
3. Look for key indicators like document titles, form layouts, company names, specific fields, or document patterns
4. Consider the document's purpose and the type of data it contains

RESPONSE FORMAT:
You must respond with ONLY a JSON object in this exact format:
{
  "detectedTypeId": "TYPE_ID_HERE_OR_NULL",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of why this type was selected or why no match was found"
}

IMPORTANT RULES:
- If you find a clear match, use the exact TYPE ID from the list above
- If you're uncertain between multiple types, choose the one with the highest confidence and set confidence to "medium" or "low"
- If no extraction type clearly matches the document, set "detectedTypeId" to null
- Always provide a brief reasoning for your decision
- Confidence levels:
  * "high": Very confident this is the correct type (90%+ certainty)
  * "medium": Reasonably confident (70-89% certainty)
  * "low": Some indicators match but not entirely certain (50-69% certainty)
- Return ONLY the JSON object, no additional text or formatting

Please analyze the document and classify it now.
`

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
    let responseText = response.text().trim()

    // Clean up the response - remove any markdown formatting
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Parse the AI response
    try {
      const detectionResult = JSON.parse(responseText)
      
      // Validate the response structure
      if (typeof detectionResult !== 'object' || detectionResult === null) {
        throw new Error('Invalid response format from AI')
      }

      const { detectedTypeId, confidence, reasoning } = detectionResult

      // Validate detectedTypeId
      if (detectedTypeId !== null && typeof detectedTypeId !== 'string') {
        throw new Error('Invalid detectedTypeId in AI response')
      }

      // If a type ID was returned, verify it exists in our extraction types
      if (detectedTypeId && !extractionTypes.find(type => type.id === detectedTypeId)) {
        console.warn('AI returned unknown extraction type ID:', detectedTypeId)
        return new Response(
          JSON.stringify({
            detectedTypeId: null,
            confidence: null,
            reasoning: 'AI returned an unknown extraction type ID'
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Validate confidence level
      const validConfidenceLevels = ['high', 'medium', 'low']
      const validatedConfidence = validConfidenceLevels.includes(confidence) ? confidence : null

      return new Response(
        JSON.stringify({
          detectedTypeId: detectedTypeId,
          confidence: validatedConfidence,
          reasoning: typeof reasoning === 'string' ? reasoning : 'No reasoning provided'
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )

    } catch (parseError) {
      console.error('Failed to parse AI detection response:', parseError)
      console.error('Raw AI response:', responseText)
      throw new Error('AI returned an invalid response format. Please try again.')
    }

  } catch (error) {
    console.error("PDF type detection error:", error)
    
    return new Response(
      JSON.stringify({ 
        error: "PDF type detection failed", 
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})