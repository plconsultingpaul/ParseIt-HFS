import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ExtractionType, VendorExtractionRule } from '../types';
import { withRetry } from './retryHelper';

export interface DetectionRequest {
  pdfFile: File;
  extractionTypes: ExtractionType[];
  vendorRules?: VendorExtractionRule[];
  apiKey: string;
}

export interface DetectionResult {
  detectedTypeId: string | null;
  detectedRuleId?: string | null;
  isVendorRule?: boolean;
  confidence: 'high' | 'medium' | 'low' | null;
  reasoning?: string;
}

export async function detectExtractionType({
  pdfFile,
  extractionTypes,
  vendorRules,
  apiKey
}: DetectionRequest): Promise<DetectionResult> {
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured. Please add it in the API settings.');
  }

  if (extractionTypes.length === 0 && (!vendorRules || vendorRules.length === 0)) {
    throw new Error('No extraction types available for detection.');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    // Convert PDF to base64
    const pdfBase64 = await fileToBase64(pdfFile);

    let typeInstructions = '';
    
    // If vendor rules are provided, prioritize them
    if (vendorRules && vendorRules.length > 0) {
      const vendorRuleInstructions = vendorRules
        .filter(rule => rule.isEnabled && rule.autoDetectInstructions && rule.autoDetectInstructions.trim())
        .sort((a, b) => a.priority - b.priority)
        .map(rule => `
VENDOR_RULE_ID: ${rule.id}
RULE_NAME: ${rule.ruleName}
PROCESSING_MODE: ${rule.processingMode}
DETECTION_CRITERIA: ${rule.autoDetectInstructions}
---`)
        .join('\n');
      
      if (vendorRuleInstructions.trim()) {
        typeInstructions = `VENDOR-SPECIFIC RULES (PRIORITY):\n${vendorRuleInstructions}\n\n`;
      }
    }
    
    // Add general extraction types as fallback
    const generalTypeInstructions = extractionTypes
      .filter(type => type.autoDetectInstructions && type.autoDetectInstructions.trim())
      .map(type => `
TYPE ID: ${type.id}
TYPE NAME: ${type.name}
DETECTION CRITERIA: ${type.autoDetectInstructions}
FORMAT: ${type.formatType}
---`)
      .join('\n');
    
    if (generalTypeInstructions.trim()) {
      typeInstructions += `GENERAL EXTRACTION TYPES (FALLBACK):\n${generalTypeInstructions}`;
    }

    if (!typeInstructions.trim()) {
      throw new Error('No extraction types or vendor rules have auto-detection instructions configured.');
    }

    const prompt = `
You are a document classification AI. Your task is to analyze the provided PDF document and determine which extraction type should be used based on the document's content and structure.

AVAILABLE DETECTION RULES:
${typeInstructions}

CLASSIFICATION INSTRUCTIONS:
1. PRIORITY ORDER: Check vendor-specific rules first (if any), then general extraction types
2. Carefully analyze the PDF document's content, layout, structure, and any visible text
3. Compare the document characteristics against each rule's detection criteria
4. Look for key indicators like document titles, form layouts, company names, specific fields, or document patterns
5. Consider the document's purpose and the type of data it contains

RESPONSE FORMAT:
You must respond with ONLY a JSON object in this exact format:
{
  "detectedId": "VENDOR_RULE_ID_OR_TYPE_ID_HERE_OR_NULL",
  "isVendorRule": true_or_false,
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of why this type was selected or why no match was found"
}

IMPORTANT RULES:
- If you find a clear match with a vendor rule, use the exact VENDOR_RULE_ID and set "isVendorRule" to true
- If you find a match with a general extraction type, use the exact TYPE_ID and set "isVendorRule" to false
- If you're uncertain between multiple options, choose the one with the highest confidence and set confidence to "medium" or "low"
- If no rule clearly matches the document, set "detectedId" to null and "isVendorRule" to false
- Always provide a brief reasoning for your decision
- Confidence levels:
  * "high": Very confident this is the correct type (90%+ certainty)
  * "medium": Reasonably confident (70-89% certainty)
  * "low": Some indicators match but not entirely certain (50-69% certainty)
- Return ONLY the JSON object, no additional text or formatting

Please analyze the document and classify it now.
`;

    const result = await withRetry(
      () => model.generateContent([
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64
          }
        },
        prompt
      ]),
      'Gemini API detection'
    );

    const response = await result.response;
    let responseText = response.text().trim();

    // Clean up the response - remove any markdown formatting
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Fix invalid escaped single quotes in JSON
    responseText = responseText.replace(/\\'/g, "'");

    // Parse the AI response
    try {
      const detectionResult = JSON.parse(responseText);
      
      // Validate the response structure
      if (typeof detectionResult !== 'object' || detectionResult === null) {
        throw new Error('Invalid response format from AI');
      }

      const { detectedId, isVendorRule, confidence, reasoning } = detectionResult;

      // Validate detectedId
      if (detectedId !== null && typeof detectedId !== 'string') {
        throw new Error('Invalid detectedId in AI response');
      }

      let finalDetectedTypeId = null;
      let finalDetectedRuleId = null;
      
      if (detectedId) {
        if (isVendorRule && vendorRules) {
          // Check if it's a valid vendor rule
          const vendorRule = vendorRules.find(rule => rule.id === detectedId);
          if (vendorRule) {
            finalDetectedRuleId = detectedId;
            // Get the associated type ID from the vendor rule
            finalDetectedTypeId = vendorRule.processingMode === 'extraction' 
              ? vendorRule.extractionTypeId 
              : vendorRule.transformationTypeId;
          } else {
            console.warn('AI returned unknown vendor rule ID:', detectedId);
          }
        } else {
          // Check if it's a valid extraction type
          if (extractionTypes.find(type => type.id === detectedId)) {
            finalDetectedTypeId = detectedId;
          } else {
            console.warn('AI returned unknown extraction type ID:', detectedId);
          }
        }
      }
      
      if (detectedId && !finalDetectedTypeId) {
        return {
          detectedTypeId: null,
          detectedRuleId: null,
          isVendorRule: false,
          confidence: null,
          reasoning: 'AI returned an unknown ID'
        };
      }

      // Validate confidence level
      const validConfidenceLevels = ['high', 'medium', 'low'];
      const validatedConfidence = validConfidenceLevels.includes(confidence) ? confidence : null;

      return {
        detectedTypeId: finalDetectedTypeId,
        detectedRuleId: finalDetectedRuleId,
        isVendorRule: !!isVendorRule,
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