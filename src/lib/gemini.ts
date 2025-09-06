import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFDocument } from 'pdf-lib';

export interface ExtractionRequest {
  pdfFile: File;
  defaultInstructions: string;
  additionalInstructions?: string;
  formatTemplate: string;
  formatType?: string;
  fieldMappings?: any[];
  parseitIdMapping?: string;
  traceTypeMapping?: string;
  traceTypeValue?: string;
  apiKey: string;
}

export async function extractDataFromPDF({
  pdfFile,
  defaultInstructions,
  additionalInstructions,
  formatTemplate,
  formatType = 'XML',
  fieldMappings = [],
  parseitIdMapping,
  traceTypeMapping,
  traceTypeValue,
  apiKey
}: ExtractionRequest): Promise<string> {
  if (!apiKey) {
    throw new Error('Google Gemini API key not configured. Please add it in the API settings.');
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert PDF to base64
    const pdfBase64 = await fileToBase64(pdfFile);

    // Combine instructions
    const fullInstructions = additionalInstructions 
      ? `${defaultInstructions}\n\nAdditional Instructions: ${additionalInstructions}`
      : defaultInstructions;

    const isJsonFormat = formatType === 'JSON';
    const outputFormat = isJsonFormat ? 'JSON' : 'XML';
    const templateLabel = isJsonFormat ? 'JSON structure' : 'XML template structure';

    // Add postal code formatting rules
    const postalCodeRules = `

POSTAL CODE FORMATTING RULES:
- Canadian Postal Codes: Always format as "AAA AAA" (3 letters, space, 3 letters/numbers) - Example: "H1W 1S3" not "H1W1S3"
- US Zip Codes: Always format as "11111" (5 digits, no spaces or dashes) - Example: "90210" not "90210-1234"
- If you detect a Canadian postal code pattern (letter-number-letter number-letter-number), add the space: "H1W1S3" becomes "H1W 1S3"
- If you detect a US zip code pattern, use only the first 5 digits: "90210-1234" becomes "90210"`;

    // Build field mapping instructions for JSON
    let fieldMappingInstructions = '';
    if (isJsonFormat && fieldMappings.length > 0) {
      fieldMappingInstructions = '\n\nFIELD MAPPING INSTRUCTIONS:\n';
      fieldMappings.forEach(mapping => {
        if (mapping.type === 'hardcoded') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (as string with exact case)' : 
                              mapping.dataType === 'number' ? ' (format as number)' : 
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? ' (as datetime string in yyyy-MM-ddThh:mm:ss format)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": Always use the EXACT hardcoded value "${mapping.value}" with precise case preservation${dataTypeNote}\n`;
        } else if (mapping.type === 'mapped') {
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as string)' : 
                              mapping.dataType === 'number' ? ' (format as number)' : 
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? ' (format as datetime in yyyy-MM-ddThh:mm:ss format)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`;
        } else {
          // AI type - use default instructions behavior
          const dataTypeNote = mapping.dataType === 'string' ? ' (format as string)' : 
                              mapping.dataType === 'number' ? ' (format as number)' : 
                              mapping.dataType === 'integer' ? ' (format as integer)' :
                              mapping.dataType === 'datetime' ? ' (format as datetime in yyyy-MM-ddThh:mm:ss format)' : '';
          fieldMappingInstructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}\n`;
        }
      });
    }

    // Add ParseIt ID mapping instructions for JSON
    let parseitIdInstructions = '';
    if (isJsonFormat && parseitIdMapping) {
      parseitIdInstructions = `\n\nPARSEIT ID MAPPING:\n- "${parseitIdMapping}": This field will be automatically populated with a unique ParseIt ID number. For now, use the placeholder value "{{PARSEIT_ID_PLACEHOLDER}}" (this will be replaced automatically).\n`;
    }

    // Add trace type mapping instructions for JSON
    let traceTypeInstructions = '';
    if (isJsonFormat && traceTypeMapping && traceTypeValue) {
      traceTypeInstructions = `\n\nTRACE TYPE MAPPING:\n- "${traceTypeMapping}": Always set this field to the exact value "${traceTypeValue}".\n`;
    }

    // Add ParseIt ID mapping instructions for XML
    let xmlParseitIdInstructions = '';
    if (!isJsonFormat && parseitIdMapping) {
      xmlParseitIdInstructions = `\n\nPARSEIT ID MAPPING FOR XML:\n- At the XML path "${parseitIdMapping}": Insert the placeholder value "{{PARSEIT_ID_PLACEHOLDER}}" (this will be replaced automatically with a unique ParseIt ID).\n`;
    }

    // Add trace type mapping instructions for XML
    let xmlTraceTypeInstructions = '';
    if (!isJsonFormat && traceTypeMapping && traceTypeValue) {
      xmlTraceTypeInstructions = `\n\nTRACE TYPE MAPPING FOR XML:\n- At the XML path "${traceTypeMapping}": Always set this attribute/element to the exact value "${traceTypeValue}".\n`;
    }

    const prompt = `
You are a data extraction AI. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}${fieldMappingInstructions}${parseitIdInstructions}${traceTypeInstructions}${xmlParseitIdInstructions}${xmlTraceTypeInstructions}${postalCodeRules}

OUTPUT FORMAT:
Please format the extracted data as ${outputFormat} following this EXACT ${templateLabel} structure:
${formatTemplate}

IMPORTANT GUIDELINES:
1. Only extract information that is clearly visible in the document
2. CRITICAL: Follow the EXACT structure provided in the template. Do not add extra fields at the root level or change the nesting structure
3. If a field is not found in JSON format, use empty string ("") for text fields, 0 for numbers, null for fields that should be null, or [] for arrays. For datetime fields that are empty, use today's date in yyyy-MM-ddThh:mm:ss format. For XML format, use "N/A" or leave it empty
4. Maintain the exact ${outputFormat} structure provided and preserve exact case for all hardcoded values
5. Do NOT duplicate fields outside of their proper nested structure
6. ${isJsonFormat ? 'Ensure valid JSON syntax with proper quotes and brackets' : 'Ensure all XML tags are properly closed'}
7. Use appropriate data types (dates, numbers, text). For JSON, ensure empty values are represented as empty strings (""), not "N/A". CRITICAL: For hardcoded values, use the EXACT case as specified (e.g., "True" not "true", "False" not "false"). For datetime fields, use the format yyyy-MM-ddThh:mm:ss (e.g., "2024-03-15T14:30:00"). If a datetime field is empty or not found, use today's date and current time in the same format
8. Be precise and accurate with the extracted data
9. ${isJsonFormat ? 'CRITICAL: For JSON output, the ONLY top-level key allowed is "orders". Do NOT include any other top-level keys or duplicate fields at the root level. Return ONLY the JSON structure from the template - no additional fields outside the "orders" array.' : 'CRITICAL FOR XML: Your response MUST start with the opening tag of the root element from the template and end with its closing tag. Do NOT include any XML content outside of this structure. Do NOT duplicate any elements or add extra XML blocks after the main structure. Return ONLY the complete XML structure from the template with no additional content before or after it.'}

Please provide only the ${outputFormat} output without any additional explanation or formatting.
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
    let extractedContent = response.text();

    // Clean up the response - remove any markdown formatting
    if (isJsonFormat) {
      extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Post-process JSON to enforce structure and handle field mappings
      try {
        let jsonData = JSON.parse(extractedContent);
        
        // STEP 1: Remove any unwanted top-level keys (only "orders" should exist at root)
        const allowedTopLevelKeys = ['orders'];
        const keysToRemove = Object.keys(jsonData).filter(key => !allowedTopLevelKeys.includes(key));
        keysToRemove.forEach(key => {
          delete jsonData[key];
        });
        
        // STEP 2: Ensure "orders" exists and is an array
        if (!jsonData.orders || !Array.isArray(jsonData.orders)) {
          jsonData.orders = [];
        }
        
        // STEP 3: Process field mappings and data types for each order
        if (fieldMappings.length > 0) {
          const currentDateTime = new Date().toISOString().slice(0, 19); // yyyy-MM-ddThh:mm:ss format
          
          const processObject = (obj: any, mappings: any[]) => {
            mappings.forEach(mapping => {
              if (mapping.dataType === 'datetime') {
                const fieldPath = mapping.fieldName.split('.');
                let current = obj;
                
                // Navigate to the field location
                for (let i = 0; i < fieldPath.length - 1; i++) {
                  if (current[fieldPath[i]] === undefined) {
                    current[fieldPath[i]] = {};
                  }
                  current = current[fieldPath[i]];
                }
                
                const finalField = fieldPath[fieldPath.length - 1];
                
                // Set default datetime if field is empty or doesn't exist
                if (!current[finalField] || current[finalField] === "" || current[finalField] === "N/A") {
                  if (mapping.type === 'hardcoded' && mapping.value) {
                    current[finalField] = mapping.value;
                  } else {
                    current[finalField] = currentDateTime;
                  }
                }
              } else if (mapping.dataType === 'string' || !mapping.dataType) {
                const fieldPath = mapping.fieldName.split('.');
                let current = obj;
                
                // Navigate to the field location
                for (let i = 0; i < fieldPath.length - 1; i++) {
                  if (current[fieldPath[i]] === undefined) {
                    current[fieldPath[i]] = {};
                  }
                  current = current[fieldPath[i]];
                }
                
                const finalField = fieldPath[fieldPath.length - 1];
                
                // Convert null string fields to empty strings, but preserve other falsy values like ""
                if (current[finalField] === null || current[finalField] === "null") {
                  current[finalField] = "";
                }
                
                // Apply max length truncation for string fields
                if (mapping.maxLength && typeof mapping.maxLength === 'number' && mapping.maxLength > 0) {
                  if (typeof current[finalField] === 'string' && current[finalField].length > mapping.maxLength) {
                    current[finalField] = current[finalField].substring(0, mapping.maxLength);
                  }
                }
              }
            });
          };
          
          // Helper function to format postal codes based on province/state
          const formatPostalCode = (postalCode: string, province: string): string => {
            if (!postalCode || !province) return postalCode;
            
            // Clean the postal code (remove spaces, hyphens, etc.)
            const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();
            
            // Canadian provinces
            const canadianProvinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
            
            if (canadianProvinces.includes(province.toUpperCase())) {
              // Canadian postal code: A1A 1A1 format
              if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
                return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
              }
            } else {
              // US zip code: 12345 format (remove extended zip)
              if (/^\d{5}(\d{4})?$/.test(cleaned)) {
                return cleaned.substring(0, 5);
              }
            }
            
            // Return original if no formatting rules apply
            return postalCode;
          };
          
          // Helper function to format zone postal codes (startZone/endZone)
          const formatZonePostalCode = (postalCode: string): string => {
            if (!postalCode) return postalCode;
            
            // Clean the postal code (remove spaces, hyphens, etc.)
            const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();
            
            // Check if it matches Canadian postal code pattern
            if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
              return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
            }
            
            // Check if it matches US zip code pattern
            if (/^\d{5}(\d{4})?$/.test(cleaned)) {
              return cleaned.substring(0, 5);
            }
            
            // Return original if no formatting rules apply
            return postalCode;
          };
          
          // Helper function to recursively format postal codes in an object
          const formatPostalCodes = (obj: any) => {
            if (Array.isArray(obj)) {
              obj.forEach(item => formatPostalCodes(item));
            } else if (obj && typeof obj === 'object') {
              // Check if this object has both postalCode and province fields
              if (obj.postalCode && obj.province) {
                obj.postalCode = formatPostalCode(obj.postalCode, obj.province);
              }
              
              // Format startZone and endZone fields (these are standalone postal codes)
              if (obj.startZone) {
                obj.startZone = formatZonePostalCode(obj.startZone);
              }
              if (obj.endZone) {
                obj.endZone = formatZonePostalCode(obj.endZone);
              }
              
              // Recursively process nested objects
              for (const value of Object.values(obj)) {
                if (typeof value === 'object') {
                  formatPostalCodes(value);
                }
              }
            }
          };
          
          // Additional cleanup: recursively find and fix all null string values
          const cleanupNullStrings = (obj: any) => {
            if (Array.isArray(obj)) {
              obj.forEach(item => cleanupNullStrings(item));
            } else if (obj && typeof obj === 'object') {
              for (const [key, value] of Object.entries(obj)) {
                if (value === null || value === "null") {
                  // Check if this should be a string field based on field mappings
                  const mapping = fieldMappings.find(m => m.fieldName.endsWith(key) || m.fieldName === key);
                  if (!mapping || mapping.dataType === 'string' || !mapping.dataType) {
                    obj[key] = "";
                  }
                } else if (typeof value === 'object') {
                  cleanupNullStrings(value);
                }
              }
            }
          };
          
          // Process each order in the orders array
          jsonData.orders.forEach((order: any) => {
            processObject(order, fieldMappings);
            cleanupNullStrings(order);
            formatPostalCodes(order);
          });
        } else {
          // Even without field mappings, format postal codes
          const formatPostalCodes = (obj: any) => {
            if (Array.isArray(obj)) {
              obj.forEach(item => formatPostalCodes(item));
            } else if (obj && typeof obj === 'object') {
              // Check if this object has both postalCode and province fields
              if (obj.postalCode && obj.province) {
                const cleaned = obj.postalCode.replace(/[\s\-]/g, '').toUpperCase();
                const canadianProvinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
                
                if (canadianProvinces.includes(obj.province.toUpperCase())) {
                  // Canadian postal code: A1A 1A1 format
                  if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
                    obj.postalCode = `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
                  }
                } else {
                  // US zip code: 12345 format (remove extended zip)
                  if (/^\d{5}(\d{4})?$/.test(cleaned)) {
                    obj.postalCode = cleaned.substring(0, 5);
                  }
                }
              }
              
               // Format startZone and endZone fields (these are standalone postal codes)
               if (obj.startZone) {
                 const cleaned = obj.startZone.replace(/[\s\-]/g, '').toUpperCase();
                 // Check if it matches Canadian postal code pattern
                 if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
                   obj.startZone = `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
                 } else if (/^\d{5}(\d{4})?$/.test(cleaned)) {
                   // US zip code format
                   obj.startZone = cleaned.substring(0, 5);
                 }
               }
               if (obj.endZone) {
                 const cleaned = obj.endZone.replace(/[\s\-]/g, '').toUpperCase();
                 // Check if it matches Canadian postal code pattern
                 if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
                   obj.endZone = `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
                 } else if (/^\d{5}(\d{4})?$/.test(cleaned)) {
                   // US zip code format
                   obj.endZone = cleaned.substring(0, 5);
                 }
               }
               
              // Recursively process nested objects
              for (const value of Object.values(obj)) {
                if (typeof value === 'object') {
                  formatPostalCodes(value);
                }
              }
            }
          };
          
          // Format postal codes even without field mappings
          jsonData.orders.forEach((order: any) => {
            formatPostalCodes(order);
          });
        }
        
        extractedContent = JSON.stringify(jsonData, null, 2);
      } catch (parseError) {
        console.warn('Could not parse JSON for post-processing:', parseError);
        // If parsing fails, we'll continue with the original content
      }

    } else {
      extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Post-process XML with precise trimming to remove any extraneous content
      try {
        // Find the root element from the template
        const templateMatch = formatTemplate.match(/<(\w+)[^>]*>/);
        if (templateMatch) {
          const rootElement = templateMatch[1];
          
          // Find the first occurrence of the opening tag and last occurrence of the closing tag
          const openingTag = `<${rootElement}`;
          const closingTag = `</${rootElement}>`;
          
          const startIndex = extractedContent.indexOf(openingTag);
          const endIndex = extractedContent.lastIndexOf(closingTag);
          
          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            // Calculate the end position (include the closing tag)
            const endPosition = endIndex + closingTag.length;
            
            // Extract only the content between the first opening tag and last closing tag
            extractedContent = extractedContent.substring(startIndex, endPosition).trim();
            
            console.log(`XML trimmed: found ${rootElement} from position ${startIndex} to ${endPosition}`);
          } else {
            console.warn(`Could not find complete ${rootElement} structure in XML response`);
            // Try to find any XML-like content as fallback
            if (extractedContent.includes('<') && extractedContent.includes('>')) {
              console.warn('Using original XML content as fallback');
            } else {
              throw new Error(`No valid ${rootElement} XML structure found in AI response`);
            }
          }
        }
      } catch (parseError) {
        console.warn('XML post-processing failed:', parseError);
        // If post-processing fails completely, ensure we at least have some XML content
        if (!extractedContent.includes('<') || !extractedContent.includes('>')) {
          throw new Error('No valid XML content found in AI response');
        }
      }
    }

    // Validate the response format
    if (isJsonFormat) {
      // Validate JSON
      try {
        JSON.parse(extractedContent);
      } catch (error) {
        throw new Error('Invalid JSON response from AI. Please try again.');
      }
    } else {
      // Validate XML
      if (!extractedContent.includes('<?xml') && !extractedContent.includes('<')) {
        throw new Error('Invalid XML response from AI. Please try again.');
      }
      
      // Additional validation: ensure the XML contains the expected root element
      try {
        const templateMatch = formatTemplate.match(/<(\w+)[^>]*>/);
        if (templateMatch) {
          const rootElement = templateMatch[1];
          if (!extractedContent.includes(`<${rootElement}`)) {
            throw new Error(`XML response missing expected root element: ${rootElement}`);
          }
        }
      } catch (validationError) {
        console.warn('XML structure validation warning:', validationError);
        // Don't throw here, just log the warning
      }
    }

    return extractedContent;
  } catch (error) {
    console.error('Error extracting data from page:', error);
    throw new Error(`Failed to extract data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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