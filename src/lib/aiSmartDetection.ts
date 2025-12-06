import { GoogleGenerativeAI } from '@google/generative-ai';
import * as pdfjsLib from 'pdfjs-dist';
import { geminiConfigService } from '../services/geminiConfigService';

async function getActiveModelName(): Promise<string> {
  try {
    const config = await geminiConfigService.getActiveConfiguration();
    if (config && config.modelName) {
      return config.modelName;
    }
  } catch (error) {
    console.warn('Failed to fetch active Gemini model, using default:', error);
  }
  return 'gemini-2.5-pro';
}

export interface SmartDetectionRequest {
  pageText: string;
  pattern: string;
  confidenceThreshold?: number;
  apiKey: string;
}

export interface SmartDetectionResult {
  match: boolean;
  confidence: number;
  reasoning: string;
}

export async function detectPatternWithAI({
  pageText,
  pattern,
  confidenceThreshold = 0.7,
  apiKey
}: SmartDetectionRequest): Promise<SmartDetectionResult> {
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured for AI smart detection');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const activeModelName = await getActiveModelName();
    const model = genAI.getGenerativeModel({ model: activeModelName });

    const prompt = `You are a pattern detection AI analyzing PDF text content. Your task is to determine if the provided text matches a given pattern or description.

PATTERN TO DETECT:
${pattern}

PAGE TEXT CONTENT:
${pageText}

INSTRUCTIONS:
1. Analyze the page text to determine if it matches the pattern description
2. The pattern may be:
   - A specific text string to find (e.g., "Transport Bourassa")
   - A descriptive condition (e.g., "If there is a dollar amount after TOTAL CDN")
   - A structural indicator (e.g., "Pages with invoice line items")
3. Be flexible with matching - consider:
   - Case variations (upper/lower case)
   - Minor spacing or formatting differences
   - Semantic meaning rather than exact text matching
4. Provide a confidence score from 0.0 to 1.0:
   - 1.0 = Perfect match, pattern clearly present
   - 0.7-0.9 = Strong match, pattern very likely present
   - 0.4-0.6 = Possible match, some indicators present
   - 0.0-0.3 = Weak or no match

RESPOND WITH VALID JSON ONLY (no markdown, no code blocks):
{
  "match": true or false (true if confidence >= threshold),
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation of why the pattern does or doesn't match"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text().trim();

    // Remove markdown formatting if present
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const detectionResult = JSON.parse(responseText);

    // Apply confidence threshold
    const finalMatch = detectionResult.confidence >= confidenceThreshold;

    return {
      match: finalMatch,
      confidence: detectionResult.confidence,
      reasoning: detectionResult.reasoning
    };

  } catch (error) {
    console.error('AI smart detection error:', error);
    throw new Error(`AI pattern detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export interface PageTextPreviewRequest {
  pdfFile: File;
  apiKey: string;
}

export interface PageTextPreview {
  pageNumber: number;
  text: string;
  textLength: number;
}

export async function extractPageTextPreviews(pdfFile: File): Promise<PageTextPreview[]> {
  // Set up PDF.js worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

  try {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const previews: PageTextPreview[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Extract text items with better formatting preservation
        const pageText = textContent.items
          .map((item: any) => {
            if ('str' in item) {
              return item.str;
            }
            return '';
          })
          .filter(str => str.trim())
          .join(' ');

        previews.push({
          pageNumber: pageNum,
          text: pageText,
          textLength: pageText.length
        });
      } catch (pageError) {
        console.error(`Error extracting text from page ${pageNum}:`, pageError);
        previews.push({
          pageNumber: pageNum,
          text: '',
          textLength: 0
        });
      }
    }

    return previews;
  } catch (error) {
    console.error('Error extracting page text previews:', error);
    throw new Error(`Failed to extract page text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
