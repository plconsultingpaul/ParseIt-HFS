import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExtractionType } from '../types';

export interface DetectionRequest {
  pdfFile: File;
  extractionTypes: ExtractionType[];
  apiKey: string;
}

export interface DetectionResult {
  detectedTypeId: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  reasoning?: string;
}

export async function detectExtractionType({
  pdfFile,
  extractionTypes,
  apiKey
}: DetectionRequest): Promise<DetectionResult> {
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured. Please add it in the API settings.');
  }

  if (extractionTypes.length === 0) {
    throw new Error('No extraction types available for detection.');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Convert PDF to base64
    const pdfBase64 = await fileToBase64(pdfFile);

    // Build the detection instructions for each extraction type
    const typeInstructions = extractionTypes
      .filter(type => type.autoDetectInstructions && type.autoDetectInstructions.trim())
      .map(type => `
TYPE ID: ${type.id}
TYPE NAME: ${type.name}
DETECTION CRITERIA: ${type.autoDetectInstructions}
FORMAT: ${type.formatType}
---`)
      .join('\n');

    if (!typeInstructions.trim()) {
      throw new Error('No extraction types have auto-detection instructions configured.');
    }

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
`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64
        }
      },
      prompt
    ]);

    const response = await result.response;
    let responseText = response.text().trim();

    // Clean up the response - remove any markdown formatting
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse the AI response
    try {
      const detectionResult = JSON.parse(responseText);
      
      // Validate the response structure
      if (typeof detectionResult !== 'object' || detectionResult === null) {
        throw new Error('Invalid response format from AI');
      }

      const { detectedTypeId, confidence, reasoning } = detectionResult;

      // Validate detectedTypeId
      if (detectedTypeId !== null && typeof detectedTypeId !== 'string') {
        throw new Error('Invalid detectedTypeId in AI response');
      }

      // If a type ID was returned, verify it exists in our extraction types
      if (detectedTypeId && !extractionTypes.find(type => type.id === detectedTypeId)) {
        console.warn('AI returned unknown extraction type ID:', detectedTypeId);
        return {
          detectedTypeId: null,
          confidence: null,
          reasoning: 'AI returned an unknown extraction type ID'
        };
      }

      // Validate confidence level
      const validConfidenceLevels = ['high', 'medium', 'low'];
      const validatedConfidence = validConfidenceLevels.includes(confidence) ? confidence : null;

      return {
        detectedTypeId: detectedTypeId,
        confidence: validatedConfidence,
        reasoning: typeof reasoning === 'string' ? reasoning : 'No reasoning provided'
      };

    } catch (parseError) {
      console.error('Failed to parse AI detection response:', parseError);
      console.error('Raw AI response:', responseText);
      throw new Error('AI returned an invalid response format. Please try again.');
    }

  } catch (error) {
    console.error('Error detecting extraction type:', error);
    throw new Error(`Failed to detect extraction type: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64 data
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}