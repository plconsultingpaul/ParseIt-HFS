import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { Buffer } from 'node:buffer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function truncateJsonEscaped(str: string, maxLength: number): string {
  if (!str || maxLength <= 0) {
    return '';
  }

  const getJsonEscapedLength = (s: string): number => {
    return JSON.stringify(s).length - 2;
  };

  if (getJsonEscapedLength(str) <= maxLength) {
    return str;
  }

  let left = 0;
  let right = str.length;
  let result = '';

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const prefix = str.substring(0, mid);
    const escapedLength = getJsonEscapedLength(prefix);

    if (escapedLength <= maxLength) {
      result = prefix;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return result;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    const tenDigits = digits.slice(1);
    return `${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`;
  }

  return "";
}

function normalizeBooleanValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'False';
  }

  const strValue = String(value).trim().toLowerCase();

  if (strValue === 'true' || strValue === 'yes' || strValue === '1') {
    return 'True';
  }

  if (strValue === 'false' || strValue === 'no' || strValue === '0') {
    return 'False';
  }

  return 'False';
}

interface FieldMapping {
  fieldName: string;
  type: 'hardcoded' | 'mapped' | 'ai';
  value?: string;
  dataType?: string;
  maxLength?: number;
  removeIfNull?: boolean;
  isWorkflowOnly?: boolean;
}

interface ArraySplitConfig {
  targetArrayField: string;
  splitBasedOnField: string;
  splitStrategy: 'one_per_entry' | 'divide_evenly';
  defaultToOneIfMissing?: boolean;
}

function buildFieldMappingInstructions(fieldMappings: FieldMapping[]): string {
  const regularMappings = fieldMappings.filter(m => !m.isWorkflowOnly);
  if (regularMappings.length === 0) return '';

  let instructions = '\n\nFIELD MAPPING INSTRUCTIONS:\n';
  regularMappings.forEach(mapping => {
    const dataTypeNote = mapping.dataType === 'string' ? ' (format as UPPER CASE string)' :
                        mapping.dataType === 'number' ? ' (format as number)' :
                        mapping.dataType === 'integer' ? ' (format as integer)' :
                        mapping.dataType === 'datetime' ? ' (format as datetime in yyyy-MM-ddThh:mm:ss format)' :
                        mapping.dataType === 'phone' ? ' (format as phone number XXX-XXX-XXXX)' :
                        mapping.dataType === 'boolean' ? ' (format as True or False)' : '';

    if (mapping.type === 'hardcoded') {
      instructions += `- "${mapping.fieldName}": Always use the EXACT hardcoded value "${mapping.value}"${dataTypeNote}\n`;
    } else if (mapping.type === 'mapped') {
      instructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`;
    } else {
      instructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}\n`;
    }
  });
  return instructions;
}

function buildWfoInstructions(fieldMappings: FieldMapping[]): string {
  const wfoMappings = fieldMappings.filter(m => m.isWorkflowOnly);
  if (wfoMappings.length === 0) return '';

  let instructions = '\n\nWORKFLOW-ONLY FIELDS (SEPARATE EXTRACTION):\n';
  instructions += 'Extract these additional fields as standalone variables for workflow use (NOT part of the main template structure):\n';
  wfoMappings.forEach(mapping => {
    const dataTypeNote = mapping.dataType === 'string' ? ' (as UPPER CASE string)' :
                        mapping.dataType === 'number' ? ' (format as number)' :
                        mapping.dataType === 'integer' ? ' (format as integer)' :
                        mapping.dataType === 'datetime' ? ' (as datetime string in yyyy-MM-ddThh:mm:ss format)' :
                        mapping.dataType === 'phone' ? ' (as formatted phone number XXX-XXX-XXXX)' :
                        mapping.dataType === 'boolean' ? ' (format as True or False)' : '';

    if (mapping.type === 'hardcoded') {
      instructions += `- "${mapping.fieldName}": Always use the EXACT hardcoded value "${mapping.value}"${dataTypeNote}\n`;
    } else if (mapping.type === 'mapped') {
      instructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`;
    } else {
      instructions += `- "${mapping.fieldName}": ${mapping.value || 'Extract from PDF document'}${dataTypeNote}\n`;
    }
  });
  return instructions;
}

function buildArraySplitInstructions(arraySplitConfigs: ArraySplitConfig[]): string {
  if (!arraySplitConfigs || arraySplitConfigs.length === 0) return '';

  let instructions = '\n\nARRAY SPLIT INSTRUCTIONS:\n';
  arraySplitConfigs.forEach(config => {
    if (config.splitStrategy === 'one_per_entry') {
      const fallbackInstruction = config.defaultToOneIfMissing
        ? ` If the "${config.splitBasedOnField}" field is not found, empty, or has a value of 0, create 1 entry in the "${config.targetArrayField}" array with "${config.splitBasedOnField}" set to 1.`
        : '';
      instructions += `- For the "${config.targetArrayField}" array: Look at the value of the "${config.splitBasedOnField}" field in the document. If this field has a value of N (for example, if "${config.splitBasedOnField}" = 3), create N separate entries in the "${config.targetArrayField}" array. Each entry should have "${config.splitBasedOnField}" set to 1, and all other fields should contain the same data from the document.${fallbackInstruction}\n`;
    } else {
      const fallbackInstruction = config.defaultToOneIfMissing
        ? ` If the "${config.splitBasedOnField}" field is not found, empty, or has a value of 0, create 1 entry in the "${config.targetArrayField}" array.`
        : '';
      instructions += `- For the "${config.targetArrayField}" array: Look at the value of the "${config.splitBasedOnField}" field and create multiple entries distributing the value evenly across them based on the data in the document.${fallbackInstruction}\n`;
    }
  });
  return instructions;
}

interface SplitPageResult {
  filename: string;
  base64: string;
  pageNumber: number;
  originalFilename: string;
}

async function splitPdfIntoPages(attachment: { filename: string; base64: string }, extractionType: any): Promise<SplitPageResult[]> {
  const jsonMultiPageProcessing = extractionType.json_multi_page_processing;

  if (jsonMultiPageProcessing === true) {
    console.log('json_multi_page_processing is TRUE - processing all pages as one document');
    return [{
      filename: attachment.filename,
      base64: attachment.base64,
      pageNumber: 0,
      originalFilename: attachment.filename
    }];
  }

  console.log('json_multi_page_processing is FALSE - splitting PDF into individual pages');

  const pdfBuffer = Buffer.from(attachment.base64, 'base64');
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();

  console.log(`Total pages in PDF: ${totalPages}`);

  const results: SplitPageResult[] = [];
  const baseFilename = attachment.filename.replace('.pdf', '').replace('.PDF', '');

  for (let i = 0; i < totalPages; i++) {
    const singlePageDoc = await PDFDocument.create();
    const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
    singlePageDoc.addPage(copiedPage);
    const pdfBytes = await singlePageDoc.save();
    const base64Data = Buffer.from(pdfBytes).toString('base64');

    results.push({
      filename: `${baseFilename}_page_${i + 1}.pdf`,
      base64: base64Data,
      pageNumber: i + 1,
      originalFilename: attachment.filename
    });
  }

  console.log(`Split PDF into ${results.length} separate pages for processing`);
  return results;
}

const postalCodeRules = `

POSTAL CODE FORMATTING RULES:
- Canadian Postal Codes: Always format as "AAA AAA" (3 letters, space, 3 letters/numbers) - Example: "H1W 1S3" not "H1W1S3"
- US Zip Codes: Always format as "11111" (5 digits, no spaces or dashes) - Example: "90210" not "90210-1234"
- If you detect a Canadian postal code pattern (letter-number-letter number-letter-number), add the space: "H1W1S3" becomes "H1W 1S3"
- If you detect a US zip code pattern, use only the first 5 digits: "90210-1234" becomes "90210"

PROVINCE AND STATE FORMATTING RULES:
- Canadian Provinces: Always format as 2-letter code only - Example: "BC" not "British Columbia", "ON" not "Ontario"
- US States: Always format as 2-letter code only - Example: "WA" not "Washington", "CA" not "California"
- If you detect a full province or state name, convert it to the 2-letter code
- Valid Canadian province codes: AB, BC, MB, NB, NL, NS, NT, NU, ON, PE, QC, SK, YT
- Valid US state codes: AL, AK, AZ, AR, CA, CO, CT, DE, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY`;

function applyFieldMappingPostProcessing(jsonData: any, fieldMappings: FieldMapping[]): any {
  const regularMappings = fieldMappings.filter(m => !m.isWorkflowOnly);
  if (regularMappings.length === 0 && (!jsonData.orders || !Array.isArray(jsonData.orders))) {
    return jsonData;
  }

  const currentDateTime = new Date().toISOString().slice(0, 19);

  const processObject = (obj: any, mappings: FieldMapping[]) => {
    mappings.forEach(mapping => {
      if (mapping.dataType === 'datetime') {
        const fieldPath = mapping.fieldName.split('.');
        let current = obj;

        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (current[fieldPath[i]] === undefined) {
            current[fieldPath[i]] = {};
          }

          if (Array.isArray(current[fieldPath[i]])) {
            const remainingPath = fieldPath.slice(i + 1).join('.');
            const nestedMapping = { ...mapping, fieldName: remainingPath };
            current[fieldPath[i]].forEach((item: any) => {
              processObject(item, [nestedMapping]);
            });
            return;
          }

          current = current[fieldPath[i]];
        }

        const finalField = fieldPath[fieldPath.length - 1];

        if (!current[finalField] || current[finalField] === "" || current[finalField] === "N/A") {
          if (mapping.type === 'hardcoded' && mapping.value) {
            current[finalField] = mapping.value;
          } else {
            current[finalField] = currentDateTime;
          }
        }
      } else if (mapping.dataType === 'phone') {
        const fieldPath = mapping.fieldName.split('.');
        let current = obj;

        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (current[fieldPath[i]] === undefined) {
            current[fieldPath[i]] = {};
          }

          if (Array.isArray(current[fieldPath[i]])) {
            const remainingPath = fieldPath.slice(i + 1).join('.');
            const nestedMapping = { ...mapping, fieldName: remainingPath };
            current[fieldPath[i]].forEach((item: any) => {
              processObject(item, [nestedMapping]);
            });
            return;
          }

          current = current[fieldPath[i]];
        }

        const finalField = fieldPath[fieldPath.length - 1];

        if (current[finalField] && typeof current[finalField] === 'string') {
          const formattedPhone = formatPhoneNumber(current[finalField]);
          current[finalField] = formattedPhone || "";
        }
      } else if (mapping.dataType === 'string' || !mapping.dataType) {
        const fieldPath = mapping.fieldName.split('.');
        let current = obj;

        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (current[fieldPath[i]] === undefined) {
            current[fieldPath[i]] = {};
          }

          if (Array.isArray(current[fieldPath[i]])) {
            const remainingPath = fieldPath.slice(i + 1).join('.');
            const nestedMapping = { ...mapping, fieldName: remainingPath };
            current[fieldPath[i]].forEach((item: any) => {
              processObject(item, [nestedMapping]);
            });
            return;
          }

          current = current[fieldPath[i]];
        }

        const finalField = fieldPath[fieldPath.length - 1];

        if (current[finalField] === null || current[finalField] === "null") {
          current[finalField] = "";
        }

        if (typeof current[finalField] === 'string' && current[finalField] !== "") {
          current[finalField] = current[finalField].toUpperCase();
        }

        if (mapping.maxLength && typeof mapping.maxLength === 'number' && mapping.maxLength > 0) {
          if (typeof current[finalField] === 'string') {
            const jsonEscapedLength = JSON.stringify(current[finalField]).length - 2;
            if (jsonEscapedLength > mapping.maxLength) {
              current[finalField] = truncateJsonEscaped(current[finalField], mapping.maxLength);
            }
          }
        }
      } else if (mapping.dataType === 'boolean') {
        const fieldPath = mapping.fieldName.split('.');
        let current = obj;

        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (current[fieldPath[i]] === undefined) {
            current[fieldPath[i]] = {};
          }

          if (Array.isArray(current[fieldPath[i]])) {
            const remainingPath = fieldPath.slice(i + 1).join('.');
            const nestedMapping = { ...mapping, fieldName: remainingPath };
            current[fieldPath[i]].forEach((item: any) => {
              processObject(item, [nestedMapping]);
            });
            return;
          }

          current = current[fieldPath[i]];
        }

        const finalField = fieldPath[fieldPath.length - 1];

        if (current[finalField] !== undefined) {
          current[finalField] = normalizeBooleanValue(current[finalField]);
        }
      }
    });
  };

  const formatPostalCode = (postalCode: string, province: string): string => {
    if (!postalCode || !province) return postalCode;

    const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();
    const canadianProvinces = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

    if (canadianProvinces.includes(province.toUpperCase())) {
      if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
        return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
      }
    } else {
      if (/^\d{5}(\d{4})?$/.test(cleaned)) {
        return cleaned.substring(0, 5);
      }
    }

    return postalCode;
  };

  const formatZonePostalCode = (postalCode: string): string => {
    if (!postalCode) return postalCode;

    const cleaned = postalCode.replace(/[\s\-]/g, '').toUpperCase();

    if (cleaned.length === 6 && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
    }

    if (/^\d{5}(\d{4})?$/.test(cleaned)) {
      return cleaned.substring(0, 5);
    }

    return postalCode;
  };

  const formatPostalCodes = (obj: any) => {
    if (Array.isArray(obj)) {
      obj.forEach(item => formatPostalCodes(item));
    } else if (obj && typeof obj === 'object') {
      if (obj.postalCode && obj.province) {
        obj.postalCode = formatPostalCode(obj.postalCode, obj.province);
      }

      if (obj.startZone) {
        obj.startZone = formatZonePostalCode(obj.startZone);
      }
      if (obj.endZone) {
        obj.endZone = formatZonePostalCode(obj.endZone);
      }

      for (const value of Object.values(obj)) {
        if (typeof value === 'object') {
          formatPostalCodes(value);
        }
      }
    }
  };

  const cleanupNullStrings = (obj: any) => {
    if (Array.isArray(obj)) {
      obj.forEach(item => cleanupNullStrings(item));
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === "null" || value === "N/A" || value === "n/a") {
          const mapping = regularMappings.find(m => m.fieldName.endsWith(key) || m.fieldName === key);
          if (!mapping || mapping.dataType === 'string' || !mapping.dataType) {
            obj[key] = "";
          }
        } else if (typeof value === 'object') {
          cleanupNullStrings(value);
        }
      }
    }
  };

  const removeNullFields = (obj: any, mappings: FieldMapping[]) => {
    mappings.forEach(mapping => {
      if (mapping.removeIfNull) {
        const fieldPath = mapping.fieldName.split('.');
        let current = obj;

        for (let i = 0; i < fieldPath.length - 1; i++) {
          if (!current[fieldPath[i]]) {
            return;
          }

          if (Array.isArray(current[fieldPath[i]])) {
            const remainingPath = fieldPath.slice(i + 1).join('.');
            const nestedMapping = { ...mapping, fieldName: remainingPath };
            current[fieldPath[i]].forEach((item: any) => {
              removeNullFields(item, [nestedMapping]);
            });
            return;
          }

          current = current[fieldPath[i]];
        }

        const finalField = fieldPath[fieldPath.length - 1];
        const fieldValue = current[finalField];

        if (
          fieldValue === null ||
          fieldValue === "" ||
          fieldValue === undefined ||
          fieldValue === "null"
        ) {
          delete current[finalField];
        }
      }
    });
  };

  if (jsonData.orders && Array.isArray(jsonData.orders)) {
    jsonData.orders.forEach((order: any) => {
      if (regularMappings.length > 0) {
        processObject(order, regularMappings);
        removeNullFields(order, regularMappings);
      }
      cleanupNullStrings(order);
      formatPostalCodes(order);

      if (order.traceNumbers && Array.isArray(order.traceNumbers)) {
        order.traceNumbers = order.traceNumbers.filter((trace: any) => {
          return trace.traceNumber &&
                 trace.traceNumber !== "" &&
                 trace.traceNumber !== null &&
                 trace.traceNumber !== "null";
        });
      }
    });
  }

  return jsonData;
}

serve(async (req) => {
  console.log('Email monitor function started');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let pollingLogId = null;
  let emailsCheckedCount = 0;
  let emailsProcessedCount = 0;
  let emailsFailedCount = 0;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const getActiveModelName = async () => {
    try {
      const { data: activeKeyData } = await supabase
        .from("gemini_api_keys")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

      if (activeKeyData) {
        const { data: activeModelData } = await supabase
          .from("gemini_models")
          .select("model_name")
          .eq("api_key_id", activeKeyData.id)
          .eq("is_active", true)
          .maybeSingle();

        if (activeModelData?.model_name) {
          console.log('Using active Gemini model:', activeModelData.model_name);
          return activeModelData.model_name;
        }
      }

      console.log('No active model configuration found, using default: gemini-2.5-pro');
      return 'gemini-2.5-pro';
    } catch (error) {
      console.error('Failed to fetch active model configuration:', error);
      return 'gemini-2.5-pro';
    }
  };

  const updatePollingLog = async (updates) => {
    console.log('Updating polling log with:', updates);
    if (!pollingLogId) {
      console.error('No polling log ID available for update');
      return;
    }

    const { error: updateError } = await supabase
      .from('email_polling_logs')
      .update(updates)
      .eq('id', pollingLogId);

    if (updateError) {
      console.error('Failed to update polling log:', updateError);
    } else {
      console.log('Successfully updated polling log');
    }
  };

  try {
    console.log('Creating initial polling log entry');
    
    const { data: logData, error: logError } = await supabase
      .from('email_polling_logs')
      .insert({
        provider: 'office365',
        status: 'running',
        emails_found: 0,
        emails_processed: 0
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to create polling log:', logError);
      throw logError;
    }

    pollingLogId = logData.id;
    console.log('Created polling log with ID:', pollingLogId);

    console.log('Fetching email monitoring configuration');
    
    const { data: config, error: configError } = await supabase
      .from('email_monitoring_config')
      .select('*')
      .single();

    if (configError) {
      console.error('Failed to fetch email monitoring config:', configError);
      await updatePollingLog({
        status: 'failed',
        error_message: `Failed to fetch config: ${configError.message}`,
        execution_time_ms: Date.now() - startTime
      });
      throw configError;
    }

    console.log('Email monitoring config loaded, provider:', config.provider);

    await updatePollingLog({
      provider: config.provider
    });

    if (!config.is_enabled) {
      console.log('Email monitoring is disabled');
      await updatePollingLog({
        status: 'success',
        execution_time_ms: Date.now() - startTime
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Email monitoring is disabled',
        emailsChecked: 0,
        emailsProcessed: 0,
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Fetching email processing rules and extraction types');

    const { data: rules, error: rulesError } = await supabase
      .from('email_processing_rules')
      .select(`
        id,
        rule_name,
        sender_pattern,
        subject_pattern,
        extraction_type_id,
        is_enabled,
        priority,
        extraction_types (
          id,
          name,
          default_instructions,
          xml_format,
          filename,
          format_type,
          auto_detect_instructions,
          json_path,
          field_mappings,
          parseit_id_mapping,
          trace_type_mapping,
          trace_type_value,
          workflow_id,
          json_multi_page_processing,
          extraction_type_array_splits (
            id,
            target_array_field,
            split_based_on_field,
            split_strategy,
            default_to_one_if_missing
          )
        )
      `)
      .eq('is_enabled', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('Failed to fetch processing rules:', rulesError);
      await updatePollingLog({
        status: 'failed',
        error_message: `Failed to fetch rules: ${rulesError.message}`,
        execution_time_ms: Date.now() - startTime
      });
      throw rulesError;
    }

    console.log('Found', rules?.length || 0, 'active processing rules');

    console.log('Fetching SFTP and API configurations');
    
    const { data: sftpConfigData, error: sftpConfigError } = await supabase
      .from('sftp_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (sftpConfigError) {
      console.warn('Could not fetch SFTP config:', sftpConfigError.message);
    }

    const sftpConfig = sftpConfigData || null;

    const { data: apiConfigData, error: apiConfigError } = await supabase
      .from('api_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (apiConfigError) {
      console.warn('Could not fetch API config:', apiConfigError.message);
    }

    const apiConfig = apiConfigData || null;

    const { data: activeKeyData, error: keyError } = await supabase
      .from('gemini_api_keys')
      .select('id, api_key')
      .eq('is_active', true)
      .maybeSingle();

    if (keyError) {
      console.error('Error fetching Gemini API key:', keyError.message);
    }

    if (!activeKeyData) {
      console.error('No active Gemini API key found. Please configure in Settings -> Gemini Configuration.');
    }

    const geminiApiKey = activeKeyData?.api_key || '';

    let emails = [];
    if (config.provider === 'gmail') {
      console.log('Processing Gmail emails');
      emails = await processGmailEmails(config, rules || [], sftpConfig, apiConfig, geminiApiKey, supabase);
    } else if (config.provider === 'office365') {
      console.log('Processing Office365 emails');
      emails = await processOffice365Emails(config, rules || [], sftpConfig, apiConfig, geminiApiKey, supabase);
    } else {
      console.error('Unsupported email provider:', config.provider);
      await updatePollingLog({
        status: 'failed',
        error_message: `Unsupported provider: ${config.provider}`,
        execution_time_ms: Date.now() - startTime
      });
      throw new Error(`Unsupported email provider: ${config.provider}`);
    }

    emailsCheckedCount = emails.length;
    emailsProcessedCount = emails.filter(e => e.processedSuccessfully).length;
    emailsFailedCount = emails.filter(e => !e.processedSuccessfully && e.errorMessage).length;

    console.log('Email processing completed. Found:', emailsCheckedCount, 'emails. Processed:', emailsProcessedCount, 'Failed:', emailsFailedCount);

    await supabase
      .from('email_monitoring_config')
      .update({ last_check: new Date().toISOString() })
      .eq('id', config.id);

    await updatePollingLog({
      status: 'success',
      emails_found: emailsCheckedCount,
      emails_processed: emailsProcessedCount,
      emails_failed: emailsFailedCount,
      execution_time_ms: Date.now() - startTime
    });

    console.log('Email monitoring completed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: `Email monitoring completed. Processed ${emailsProcessedCount} emails.`,
      emailsChecked: emailsCheckedCount,
      emailsProcessed: emailsProcessedCount,
      results: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Email monitor function error:', error);
    
    if (pollingLogId) {
      await updatePollingLog({
        status: 'failed',
        error_message: error.message,
        execution_time_ms: Date.now() - startTime
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      emailsChecked: emailsCheckedCount,
      emailsProcessed: emailsProcessedCount,
      results: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processGmailEmails(config, rules, sftpConfig, apiConfig, geminiApiKey, supabase) {
  console.log('Starting Gmail email processing');

  const monitoringClientId = config.gmail_monitoring_client_id || config.gmail_client_id;
  const monitoringClientSecret = config.gmail_monitoring_client_secret || config.gmail_client_secret;
  const monitoringRefreshToken = config.gmail_monitoring_refresh_token || config.gmail_refresh_token;

  console.log('Using monitoring credentials:', {
    usingDedicatedCredentials: !!(config.gmail_monitoring_client_id && config.gmail_monitoring_client_secret && config.gmail_monitoring_refresh_token),
    clientIdSource: config.gmail_monitoring_client_id ? 'monitoring' : 'send'
  });

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: monitoringClientId,
        client_secret: monitoringClientSecret,
        refresh_token: monitoringRefreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to refresh Gmail token:', errorText);
      throw new Error(`Failed to refresh Gmail access token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('Gmail access token refreshed successfully');

    let query = `has:attachment is:unread`;

    if (config.gmail_monitored_label && config.gmail_monitored_label !== 'INBOX') {
      query += ` label:${config.gmail_monitored_label}`;
    } else {
      query += ` in:inbox`;
    }

    if (!config.check_all_messages && config.last_check) {
      const lastCheckDate = new Date(config.last_check);
      const timestamp = Math.floor(lastCheckDate.getTime() / 1000);
      query += ` after:${timestamp}`;
    }

    console.log('Gmail search query:', query);

    const searchResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Gmail search failed:', errorText);
      throw new Error(`Failed to search Gmail messages: ${errorText}`);
    }

    const searchData = await searchResponse.json();
    const messages = searchData.messages || [];
    console.log('Found', messages.length, 'Gmail messages');

    const processedEmailsResults = [];

    for (const message of messages) {
      let subject = '';
      let fromEmail = '';
      let receivedDate = '';
      let attachments = [];
      let matchingRule = null;
      let parseitId = null;
      let processedSuccessfully = false;
      let errorMessage = null;
      let extractionLogId = null;

      try {
        console.log('Processing Gmail message:', message.id);

        const messageResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!messageResponse.ok) {
          const errorText = await messageResponse.text();
          console.error('Failed to fetch message details:', errorText);
          throw new Error(`Failed to fetch message details: ${errorText}`);
        }

        const messageData = await messageResponse.json();

        const headers = messageData.payload.headers;
        subject = headers.find(h => h.name === 'Subject')?.value || '';
        const fromHeader = headers.find(h => h.name === 'From')?.value || '';
        receivedDate = headers.find(h => h.name === 'Date')?.value || '';

        const fromMatch = fromHeader.match(/<([^>]+)>/);
        fromEmail = fromMatch ? fromMatch[1] : fromHeader;

        console.log('Email details - From:', fromEmail, 'Subject:', subject);

        attachments = await findPdfAttachmentsGmail(messageData.payload, accessToken, message.id);
        console.log('PDF attachment detection result:', {
          attachmentCount: attachments.length,
          filenames: attachments.map(att => att.filename)
        });

        if (attachments.length === 0) {
          console.log('No PDF attachments found, skipping');
          errorMessage = 'No PDF attachments found';
          continue;
        }

        console.log('Found', attachments.length, 'PDF attachments');

        matchingRule = findMatchingRule(fromEmail, subject, rules);
        console.log('Rule matching result:', {
          ruleFound: !!matchingRule,
          ruleName: matchingRule?.rule_name || 'None',
          totalRulesAvailable: rules.length
        });

        if (!matchingRule) {
          console.log('No matching processing rule found, skipping');
          errorMessage = 'No matching processing rule found';
          continue;
        }

        console.log('Found matching rule:', matchingRule.rule_name);

        const extractionType = matchingRule.extraction_types;
        console.log('Extraction type check:', {
          extractionTypeFound: !!extractionType,
          extractionTypeName: extractionType?.name || 'None',
          extractionTypeId: extractionType?.id || 'None'
        });
        
        if (!extractionType) {
          console.error('Extraction type not found for rule:', matchingRule.rule_name);
          errorMessage = `Extraction type not found for rule: ${matchingRule.rule_name}`;
          continue;
        }

        for (const attachment of attachments) {
          console.log('Starting to process PDF attachment:', {
            filename: attachment.filename,
            sizeKB: Math.round(attachment.base64.length * 0.75 / 1024),
            extractionType: extractionType.name,
            pageProcessingMode: extractionType.page_processing_mode || 'all'
          });

          const splitPages = await splitPdfIntoPages(attachment, extractionType);
          console.log(`[Gmail] PDF split into ${splitPages.length} page(s) for processing`);

          for (const pageData of splitPages) {

          try {
            const { data: newLog, error: logInsertError } = await supabase
              .from('extraction_logs')
              .insert({
                user_id: null,
                extraction_type_id: extractionType.id,
                pdf_filename: pageData.filename,
                pdf_pages: 1,
                extraction_status: 'running',
                created_at: new Date().toISOString(),
                extracted_data: null,
                api_response: null,
                api_status_code: null,
                api_error: null,
                error_message: null
              })
              .select()
              .single();

            if (logInsertError) {
              console.error('Failed to create extraction log:', logInsertError);
              throw new Error(`Failed to create extraction log: ${logInsertError.message}`);
            }

            extractionLogId = newLog.id;

            const pageCount = 1;

            const modelName = await getActiveModelName();
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ model: modelName });

            const fullInstructions = extractionType.default_instructions;
            const isJsonFormat = extractionType.format_type === 'JSON';
            const outputFormat = isJsonFormat ? 'JSON' : 'XML';
            const templateLabel = isJsonFormat ? 'JSON structure' : 'XML template structure';

            const fieldMappings: FieldMapping[] = extractionType.field_mappings
              ? (typeof extractionType.field_mappings === 'string'
                  ? JSON.parse(extractionType.field_mappings)
                  : extractionType.field_mappings)
              : [];

            const arraySplitConfigs: ArraySplitConfig[] = (extractionType.extraction_type_array_splits || []).map((s: any) => ({
              targetArrayField: s.target_array_field,
              splitBasedOnField: s.split_based_on_field,
              splitStrategy: s.split_strategy,
              defaultToOneIfMissing: s.default_to_one_if_missing
            }));

            const fieldMappingInstructions = isJsonFormat ? buildFieldMappingInstructions(fieldMappings) : '';
            const arraySplitInstructions = isJsonFormat ? buildArraySplitInstructions(arraySplitConfigs) : '';
            const wfoInstructions = isJsonFormat ? buildWfoInstructions(fieldMappings) : '';
            const hasWFOFields = isJsonFormat && fieldMappings.some(m => m.isWorkflowOnly);

            let parseitIdInstructions = '';
            if (isJsonFormat && extractionType.parseit_id_mapping) {
              parseitIdInstructions = `\n\nPARSE-IT ID MAPPING:\n- "${extractionType.parseit_id_mapping}": This field will be automatically populated with a unique Parse-It ID number. For now, use the placeholder value "{{PARSE_IT_ID_PLACEHOLDER}}" (this will be replaced automatically).\n`;
            }

            let traceTypeInstructions = '';
            if (isJsonFormat && extractionType.trace_type_mapping && extractionType.trace_type_value) {
              traceTypeInstructions = `\n\nTRACE TYPE MAPPING:\n- "${extractionType.trace_type_mapping}": Always set this field to the exact value "${extractionType.trace_type_value}".\n`;
            }

            console.log('[Gmail] Building prompt with field mappings:', {
              fieldMappingsCount: fieldMappings.length,
              arraySplitConfigsCount: arraySplitConfigs.length,
              hasParseitIdMapping: !!extractionType.parseit_id_mapping,
              hasTraceTypeMapping: !!extractionType.trace_type_mapping,
              hasWFOFields: hasWFOFields
            });

            const prompt = `
You are a data extraction AI. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}${fieldMappingInstructions}${parseitIdInstructions}${traceTypeInstructions}${arraySplitInstructions}${wfoInstructions}${isJsonFormat ? postalCodeRules : ''}

OUTPUT FORMAT:
${hasWFOFields ? 'You need to extract TWO separate data structures from the PDF:\n\n1. MAIN TEMPLATE DATA:\n' : ''}Please format the extracted data as ${outputFormat} following this EXACT ${templateLabel} structure:
${extractionType.xml_format}${hasWFOFields ? '\n\n2. WORKFLOW-ONLY DATA:\nProvide the workflow-only fields as a separate JSON object with the field names as keys and their extracted values.\n\nIMPORTANT: Return BOTH structures in a wrapper object like this:\n{\n  "templateData": <your extracted template data here>,\n  "workflowOnlyData": {\n    <workflow field name>: <extracted value>,\n    ...\n  }\n}\n\nIf there are no workflow-only fields, set workflowOnlyData to an empty object {}.' : ''}

IMPORTANT GUIDELINES:
1. Only extract information that is clearly visible in the document
2. CRITICAL: Follow the EXACT structure provided in the template. Do not add extra fields at the root level or change the nesting structure
3. If a field is not found in JSON format, use empty string ("") for text fields, 0 for numbers, null for fields that should be null, or [] for arrays. For datetime fields that are empty, use today's date in yyyy-MM-ddThh:mm:ss format. For XML format, use "N/A" or leave it empty
4. Maintain the exact ${outputFormat} structure provided and preserve exact case for all hardcoded values
5. Do NOT duplicate fields outside of their proper nested structure
6. ${isJsonFormat ? 'Ensure valid JSON syntax with proper quotes and brackets' : 'Ensure all XML tags are properly closed'}
7. Use appropriate data types (dates, numbers, text). For JSON, ensure empty values are represented as empty strings (""), not "N/A". CRITICAL: For hardcoded values, use the EXACT case as specified (e.g., "True" not "true", "False" not "false"). For datetime fields, use the format yyyy-MM-ddThh:mm:ss (e.g., "2024-03-15T14:30:00"). If a datetime field is empty or not found, use today's date and current time in the same format. CRITICAL: For all string data type fields (dataType="string"), convert the extracted value to UPPER CASE before including it in the output
8. Be precise and accurate with the extracted data
9. ${isJsonFormat ? 'CRITICAL: For JSON output, the ONLY top-level key allowed is "orders". Do NOT include any other top-level keys or duplicate fields at the root level. Return ONLY the JSON structure from the template - no additional fields outside the "orders" array.' : 'CRITICAL FOR XML: Your response MUST start with the opening tag of the root element from the template and end with its closing tag. Do NOT include any XML content outside of this structure. Do NOT duplicate any elements or add extra XML blocks after the main structure. Return ONLY the complete XML structure from the template with no additional content before or after it.'}

Please provide only the ${outputFormat} output without any additional explanation or formatting.
`;

            const result = await model.generateContent([
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pageData.base64
                }
              },
              prompt
            ]);

            let extractedContent = result.response.text();
            let templateData = '';
            let workflowOnlyData = '{}';

            if (isJsonFormat) {
              extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

              console.log('Raw extracted data before validation:', extractedContent.substring(0, 500) + '...');

              if (hasWFOFields) {
                try {
                  const wrapper = JSON.parse(extractedContent);
                  if (wrapper.templateData && wrapper.workflowOnlyData !== undefined) {
                    templateData = typeof wrapper.templateData === 'string'
                      ? wrapper.templateData
                      : JSON.stringify(wrapper.templateData);
                    workflowOnlyData = typeof wrapper.workflowOnlyData === 'string'
                      ? wrapper.workflowOnlyData
                      : JSON.stringify(wrapper.workflowOnlyData);
                    console.log('[Gmail] Successfully parsed dual-structure response');
                    console.log('[Gmail] Template data length:', templateData.length);
                    console.log('[Gmail] WFO data:', workflowOnlyData);
                    extractedContent = templateData;
                  } else {
                    console.warn('[Gmail] Wrapper missing expected fields, using full response as template');
                    templateData = extractedContent;
                    workflowOnlyData = '{}';
                  }
                } catch (wrapperError) {
                  console.warn('[Gmail] Failed to parse wrapper, using full response as template:', wrapperError);
                  templateData = extractedContent;
                  workflowOnlyData = '{}';
                }
              } else {
                templateData = extractedContent;
              }

              try {
                console.log('Applying validation fixes to JSON data...');
                extractedContent = applyValidationFixes(extractedContent);
                console.log('Validation fixes applied. Final data preview:', extractedContent.substring(0, 500) + '...');
              } catch (parseError) {
                console.warn('Could not parse JSON for validation fixes:', parseError);
              }

              try {
                let jsonData = JSON.parse(extractedContent);
                console.log('[Gmail] Applying field mapping post-processing...');
                jsonData = applyFieldMappingPostProcessing(jsonData, fieldMappings);
                extractedContent = JSON.stringify(jsonData, null, 2);
                console.log('[Gmail] Field mapping post-processing complete');
              } catch (e) {
                throw new Error('AI returned invalid JSON format');
              }
            } else {
              extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

              if (!extractedContent.startsWith('<') || !extractedContent.endsWith('>')) {
                throw new Error('AI returned invalid XML format');
              }
            }

            let finalDataToSend = extractedContent;

            if (extractionType.workflow_id) {
              console.log('Workflow assigned to extraction type, executing workflow:', extractionType.workflow_id);

              const pageAttachment = { filename: pageData.filename, base64: pageData.base64 };
              const workflowResult = await executeWorkflowForEmail(
                extractionType.workflow_id,
                extractedContent,
                extractionType,
                pageAttachment,
                pageCount,
                supabase,
                fromEmail,
                extractionLogId,
                workflowOnlyData
              );

              await supabase
                .from('extraction_logs')
                .update({
                  extracted_data: extractedContent,
                  api_response: workflowResult.lastApiResponse ? JSON.stringify(workflowResult.lastApiResponse) : null,
                  extraction_status: workflowResult.success ? 'success' : 'failed',
                  error_message: workflowResult.error || null
                })
                .eq('id', extractionLogId);

              if (!workflowResult.success) {
                throw new Error(workflowResult.error || 'Workflow execution failed');
              }

              processedSuccessfully = true;
              console.log('Email attachment processed successfully via workflow');
            } else if (isJsonFormat) {
              console.log('No workflow assigned, using direct API/SFTP processing');

              const { data: newParseitId, error: parseitIdError } = await supabase.rpc('get_next_parseit_id');
              if (parseitIdError) throw new Error(`Failed to get ParseIt ID: ${parseitIdError.message}`);

              parseitId = newParseitId;

              if (extractionType.parseit_id_mapping && parseitId) {
                finalDataToSend = injectParseitId(JSON.parse(extractedContent), extractionType.parseit_id_mapping, parseitId);
                finalDataToSend = JSON.stringify(finalDataToSend, null, 2);
              }

              if (!apiConfig || !apiConfig.path || !extractionType.json_path) {
                throw new Error('API configuration incomplete for JSON extraction');
              }

              const apiUrl = apiConfig.path.endsWith('/')
                ? `${apiConfig.path.slice(0, -1)}${extractionType.json_path}`
                : `${apiConfig.path}${extractionType.json_path}`;

              console.log('Sending to API URL:', apiUrl);
              console.log('Final JSON being sent (first 1000 chars):', finalDataToSend.substring(0, 1000));

              const headers = {
                'Content-Type': 'application/json'
              };

              if (apiConfig.password) {
                headers['Authorization'] = `Bearer ${apiConfig.password}`;
              }

              const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: finalDataToSend
              });

              if (!apiResponse.ok) {
                const errorDetails = await apiResponse.text();
                throw new Error(`API call failed: ${apiResponse.status} ${apiResponse.statusText} - ${errorDetails}`);
              }

              const apiResponseData = await apiResponse.json();
              console.log('API call successful:', apiResponseData);

              await supabase
                .from('extraction_logs')
                .update({
                  api_response: JSON.stringify(apiResponseData),
                  api_status_code: apiResponse.status,
                  extracted_data: finalDataToSend,
                  extraction_status: 'success'
                })
                .eq('id', extractionLogId);

              if (sftpConfig) {
                await uploadToSftp(sftpConfig, pageData.base64, pageData.filename, extractionType.filename, extractionType.id, null, parseitId, supabase);
                console.log('PDF uploaded to SFTP for JSON type');
              } else {
                console.warn('SFTP config missing, skipping PDF upload for JSON type');
              }

              processedSuccessfully = true;
              console.log('Email attachment processed successfully via direct API');
            } else {
              console.log('No workflow assigned, using direct SFTP processing for XML');

              if (!sftpConfig) {
                throw new Error('SFTP configuration incomplete for XML extraction');
              }

              finalDataToSend = extractedContent.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, (parseitId || '').toString());

              await uploadToSftp(sftpConfig, pageData.base64, pageData.filename, extractionType.filename, extractionType.id, finalDataToSend, null, supabase);
              console.log('XML and PDF uploaded to SFTP');

              await supabase
                .from('extraction_logs')
                .update({
                  extracted_data: finalDataToSend,
                  extraction_status: 'success'
                })
                .eq('id', extractionLogId);

              processedSuccessfully = true;
              console.log('Email attachment processed successfully via direct SFTP');
            }

            await applyPostProcessAction(config, 'gmail', message.id, accessToken, null, 'success');

          } catch (processError) {
            console.error('Error processing attachment:', processError);
            errorMessage = processError.message || 'Unknown processing error';

            if (extractionLogId) {
              await supabase
                .from('extraction_logs')
                .update({
                  extraction_status: 'failed',
                  error_message: errorMessage
                })
                .eq('id', extractionLogId);
            }

            await applyPostProcessAction(config, 'gmail', message.id, accessToken, null, 'failure');
          }
          }
        }

      } catch (emailError) {
        console.error('Error handling email:', emailError);
        errorMessage = emailError.message || 'Unknown email handling error';
      } finally {
        processedEmailsResults.push({
          id: message.id,
          from: fromEmail,
          subject: subject,
          receivedDate: receivedDate,
          processedSuccessfully,
          errorMessage,
          extractionLogId,
          rule: matchingRule?.rule_name || 'No rule matched'
        });

        await supabase
          .from('processed_emails')
          .insert({
            email_id: message.id,
            sender: fromEmail,
            subject: subject,
            received_date: receivedDate,
            processing_rule_id: matchingRule?.id || null,
            extraction_type_id: matchingRule?.extraction_types?.id || null,
            pdf_filename: attachments[0]?.filename || null,
            attachment_count: attachments.length,
            pdf_filenames: attachments.map(a => a.filename).join(', ') || null,
            attachment_page_counts: attachments.map(a => a.pageCount || 1).join(', ') || null,
            processing_status: processedSuccessfully ? 'completed' : 'failed',
            error_message: errorMessage,
            parseit_id: parseitId || null,
            processed_at: new Date().toISOString()
          });
      }
    }

    return processedEmailsResults;
  } catch (error) {
    console.error('Gmail processing error:', error);
    throw error;
  }
}

async function processOffice365Emails(config, rules, sftpConfig, apiConfig, geminiApiKey, supabase) {
  console.log('Starting Office365 email processing');

  const monitoringTenantId = config.monitoring_tenant_id || config.tenant_id;
  const monitoringClientId = config.monitoring_client_id || config.client_id;
  const monitoringClientSecret = config.monitoring_client_secret || config.client_secret;

  console.log('Using monitoring credentials:', {
    usingDedicatedCredentials: !!(config.monitoring_tenant_id && config.monitoring_client_id && config.monitoring_client_secret),
    tenantIdSource: config.monitoring_tenant_id ? 'monitoring' : 'send',
    clientIdSource: config.monitoring_client_id ? 'monitoring' : 'send'
  });

  try {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${monitoringTenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: monitoringClientId,
        client_secret: monitoringClientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to get Office365 token:', errorText);
      throw new Error(`Failed to get Office365 access token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('Office365 access token obtained successfully');

    let filter = 'hasAttachments eq true and isRead eq false';
    if (!config.check_all_messages && config.last_check) {
      const lastCheckDate = new Date(config.last_check).toISOString();
      filter += ` and receivedDateTime gt ${lastCheckDate}`;
    }

    console.log('Office365 filter:', filter);

    const emailsResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${config.monitored_email}/mailFolders/Inbox/messages?$filter=${encodeURIComponent(filter)}&$select=id,subject,from,receivedDateTime,hasAttachments`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!emailsResponse.ok) {
      const errorText = await emailsResponse.text();
      console.error('Office365 emails fetch failed:', errorText);
      throw new Error(`Failed to fetch Office365 emails: ${errorText}`);
    }

    const emailsData = await emailsResponse.json();
    const emails = emailsData.value || [];
    console.log('Found', emails.length, 'Office365 emails');

    const processedEmailsResults = [];

    for (const email of emails) {
      let subject = '';
      let fromEmail = '';
      let receivedDate = '';
      let attachments = [];
      let matchingRule = null;
      let parseitId = null;
      let processedSuccessfully = false;
      let errorMessage = null;
      let extractionLogId = null;

      try {
        console.log('Processing Office365 email:', email.id);

        subject = email.subject || '';
        fromEmail = email.from?.emailAddress?.address || '';
        receivedDate = email.receivedDateTime || '';

        console.log('Email details - From:', fromEmail, 'Subject:', subject);

        attachments = await findPdfAttachmentsOffice365(config.monitored_email, email.id, accessToken);
        console.log('PDF attachment detection result:', {
          attachmentCount: attachments.length,
          filenames: attachments.map(att => att.filename)
        });

        if (attachments.length === 0) {
          console.log('No PDF attachments found, skipping');
          errorMessage = 'No PDF attachments found';
          continue;
        }

        console.log('Found', attachments.length, 'PDF attachments');

        matchingRule = findMatchingRule(fromEmail, subject, rules);
        console.log('Rule matching result:', {
          ruleFound: !!matchingRule,
          ruleName: matchingRule?.rule_name || 'None',
          totalRulesAvailable: rules.length
        });

        if (!matchingRule) {
          console.log('No matching processing rule found, skipping');
          errorMessage = 'No matching processing rule found';
          continue;
        }

        console.log('Found matching rule:', matchingRule.rule_name);

        const extractionType = matchingRule.extraction_types;
        console.log('Extraction type check:', {
          extractionTypeFound: !!extractionType,
          extractionTypeName: extractionType?.name || 'None',
          extractionTypeId: extractionType?.id || 'None'
        });
        
        if (!extractionType) {
          console.error('Extraction type not found for rule:', matchingRule.rule_name);
          errorMessage = `Extraction type not found for rule: ${matchingRule.rule_name}`;
          continue;
        }

        for (const attachment of attachments) {
          console.log('Starting to process PDF attachment:', {
            filename: attachment.filename,
            sizeKB: Math.round(attachment.base64.length * 0.75 / 1024),
            extractionType: extractionType.name,
            pageProcessingMode: extractionType.page_processing_mode || 'all'
          });

          const splitPages = await splitPdfIntoPages(attachment, extractionType);
          console.log(`[Office365] PDF split into ${splitPages.length} page(s) for processing`);

          for (const pageData of splitPages) {

          try {
            const { data: newLog, error: logInsertError } = await supabase
              .from('extraction_logs')
              .insert({
                user_id: null,
                extraction_type_id: extractionType.id,
                pdf_filename: pageData.filename,
                pdf_pages: 1,
                extraction_status: 'running',
                created_at: new Date().toISOString(),
                extracted_data: null,
                api_response: null,
                api_status_code: null,
                api_error: null,
                error_message: null
              })
              .select()
              .single();

            if (logInsertError) {
              console.error('Failed to create extraction log:', logInsertError);
              throw new Error(`Failed to create extraction log: ${logInsertError.message}`);
            }

            extractionLogId = newLog.id;

            const pageCount = 1;

            const modelName = await getActiveModelName();
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ model: modelName });

            const fullInstructions = extractionType.default_instructions;
            const isJsonFormat = extractionType.format_type === 'JSON';
            const outputFormat = isJsonFormat ? 'JSON' : 'XML';
            const templateLabel = isJsonFormat ? 'JSON structure' : 'XML template structure';

            const fieldMappings: FieldMapping[] = extractionType.field_mappings
              ? (typeof extractionType.field_mappings === 'string'
                  ? JSON.parse(extractionType.field_mappings)
                  : extractionType.field_mappings)
              : [];

            const arraySplitConfigs: ArraySplitConfig[] = (extractionType.extraction_type_array_splits || []).map((s: any) => ({
              targetArrayField: s.target_array_field,
              splitBasedOnField: s.split_based_on_field,
              splitStrategy: s.split_strategy,
              defaultToOneIfMissing: s.default_to_one_if_missing
            }));

            const fieldMappingInstructions = isJsonFormat ? buildFieldMappingInstructions(fieldMappings) : '';
            const arraySplitInstructions = isJsonFormat ? buildArraySplitInstructions(arraySplitConfigs) : '';
            const wfoInstructions = isJsonFormat ? buildWfoInstructions(fieldMappings) : '';
            const hasWFOFields = isJsonFormat && fieldMappings.some(m => m.isWorkflowOnly);

            let parseitIdInstructions = '';
            if (isJsonFormat && extractionType.parseit_id_mapping) {
              parseitIdInstructions = `\n\nPARSE-IT ID MAPPING:\n- "${extractionType.parseit_id_mapping}": This field will be automatically populated with a unique Parse-It ID number. For now, use the placeholder value "{{PARSE_IT_ID_PLACEHOLDER}}" (this will be replaced automatically).\n`;
            }

            let traceTypeInstructions = '';
            if (isJsonFormat && extractionType.trace_type_mapping && extractionType.trace_type_value) {
              traceTypeInstructions = `\n\nTRACE TYPE MAPPING:\n- "${extractionType.trace_type_mapping}": Always set this field to the exact value "${extractionType.trace_type_value}".\n`;
            }

            console.log('[Office365] Building prompt with field mappings:', {
              fieldMappingsCount: fieldMappings.length,
              arraySplitConfigsCount: arraySplitConfigs.length,
              hasParseitIdMapping: !!extractionType.parseit_id_mapping,
              hasTraceTypeMapping: !!extractionType.trace_type_mapping,
              hasWFOFields: hasWFOFields
            });

            const prompt = `
You are a data extraction AI. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}${fieldMappingInstructions}${parseitIdInstructions}${traceTypeInstructions}${arraySplitInstructions}${wfoInstructions}${isJsonFormat ? postalCodeRules : ''}

OUTPUT FORMAT:
${hasWFOFields ? 'You need to extract TWO separate data structures from the PDF:\n\n1. MAIN TEMPLATE DATA:\n' : ''}Please format the extracted data as ${outputFormat} following this EXACT ${templateLabel} structure:
${extractionType.xml_format}${hasWFOFields ? '\n\n2. WORKFLOW-ONLY DATA:\nProvide the workflow-only fields as a separate JSON object with the field names as keys and their extracted values.\n\nIMPORTANT: Return BOTH structures in a wrapper object like this:\n{\n  "templateData": <your extracted template data here>,\n  "workflowOnlyData": {\n    <workflow field name>: <extracted value>,\n    ...\n  }\n}\n\nIf there are no workflow-only fields, set workflowOnlyData to an empty object {}.' : ''}

IMPORTANT GUIDELINES:
1. Only extract information that is clearly visible in the document
2. CRITICAL: Follow the EXACT structure provided in the template. Do not add extra fields at the root level or change the nesting structure
3. If a field is not found in JSON format, use empty string ("") for text fields, 0 for numbers, null for fields that should be null, or [] for arrays. For datetime fields that are empty, use today's date in yyyy-MM-ddThh:mm:ss format. For XML format, use "N/A" or leave it empty
4. Maintain the exact ${outputFormat} structure provided and preserve exact case for all hardcoded values
5. Do NOT duplicate fields outside of their proper nested structure
6. ${isJsonFormat ? 'Ensure valid JSON syntax with proper quotes and brackets' : 'Ensure all XML tags are properly closed'}
7. Use appropriate data types (dates, numbers, text). For JSON, ensure empty values are represented as empty strings (""), not "N/A". CRITICAL: For hardcoded values, use the EXACT case as specified (e.g., "True" not "true", "False" not "false"). For datetime fields, use the format yyyy-MM-ddThh:mm:ss (e.g., "2024-03-15T14:30:00"). If a datetime field is empty or not found, use today's date and current time in the same format. CRITICAL: For all string data type fields (dataType="string"), convert the extracted value to UPPER CASE before including it in the output
8. Be precise and accurate with the extracted data
9. ${isJsonFormat ? 'CRITICAL: For JSON output, the ONLY top-level key allowed is "orders". Do NOT include any other top-level keys or duplicate fields at the root level. Return ONLY the JSON structure from the template - no additional fields outside the "orders" array.' : 'CRITICAL FOR XML: Your response MUST start with the opening tag of the root element from the template and end with its closing tag. Do NOT include any XML content outside of this structure. Do NOT duplicate any elements or add extra XML blocks after the main structure. Return ONLY the complete XML structure from the template with no additional content before or after it.'}

Please provide only the ${outputFormat} output without any additional explanation or formatting.
`;

            const result = await model.generateContent([
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pageData.base64
                }
              },
              prompt
            ]);

            let extractedContent = result.response.text();
            let templateData = '';
            let workflowOnlyData = '{}';

            if (isJsonFormat) {
              extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

              console.log('Raw extracted data before validation:', extractedContent.substring(0, 500) + '...');

              if (hasWFOFields) {
                try {
                  const wrapper = JSON.parse(extractedContent);
                  if (wrapper.templateData && wrapper.workflowOnlyData !== undefined) {
                    templateData = typeof wrapper.templateData === 'string'
                      ? wrapper.templateData
                      : JSON.stringify(wrapper.templateData);
                    workflowOnlyData = typeof wrapper.workflowOnlyData === 'string'
                      ? wrapper.workflowOnlyData
                      : JSON.stringify(wrapper.workflowOnlyData);
                    console.log('[Office365] Successfully parsed dual-structure response');
                    console.log('[Office365] Template data length:', templateData.length);
                    console.log('[Office365] WFO data:', workflowOnlyData);
                    extractedContent = templateData;
                  } else {
                    console.warn('[Office365] Wrapper missing expected fields, using full response as template');
                    templateData = extractedContent;
                    workflowOnlyData = '{}';
                  }
                } catch (wrapperError) {
                  console.warn('[Office365] Failed to parse wrapper, using full response as template:', wrapperError);
                  templateData = extractedContent;
                  workflowOnlyData = '{}';
                }
              } else {
                templateData = extractedContent;
              }

              try {
                console.log('Applying validation fixes to JSON data...');
                extractedContent = applyValidationFixes(extractedContent);
                console.log('Validation fixes applied. Final data preview:', extractedContent.substring(0, 500) + '...');
              } catch (parseError) {
                console.warn('Could not parse JSON for validation fixes:', parseError);
              }

              try {
                let jsonData = JSON.parse(extractedContent);
                console.log('[Office365] Applying field mapping post-processing...');
                jsonData = applyFieldMappingPostProcessing(jsonData, fieldMappings);
                extractedContent = JSON.stringify(jsonData, null, 2);
                console.log('[Office365] Field mapping post-processing complete');
              } catch (e) {
                throw new Error('AI returned invalid JSON format');
              }
            } else {
              extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();

              if (!extractedContent.startsWith('<') || !extractedContent.endsWith('>')) {
                throw new Error('AI returned invalid XML format');
              }
            }

            let finalDataToSend = extractedContent;

            if (extractionType.workflow_id) {
              console.log('Workflow assigned to extraction type, executing workflow:', extractionType.workflow_id);

              const pageAttachment = { filename: pageData.filename, base64: pageData.base64 };
              const workflowResult = await executeWorkflowForEmail(
                extractionType.workflow_id,
                extractedContent,
                extractionType,
                pageAttachment,
                pageCount,
                supabase,
                fromEmail,
                extractionLogId,
                workflowOnlyData
              );

              await supabase
                .from('extraction_logs')
                .update({
                  extracted_data: extractedContent,
                  api_response: workflowResult.lastApiResponse ? JSON.stringify(workflowResult.lastApiResponse) : null,
                  extraction_status: workflowResult.success ? 'success' : 'failed',
                  error_message: workflowResult.error || null
                })
                .eq('id', extractionLogId);

              if (!workflowResult.success) {
                throw new Error(workflowResult.error || 'Workflow execution failed');
              }

              processedSuccessfully = true;
              console.log('Email attachment processed successfully via workflow');
            } else if (isJsonFormat) {
              console.log('No workflow assigned, using direct API/SFTP processing');

              const { data: newParseitId, error: parseitIdError } = await supabase.rpc('get_next_parseit_id');
              if (parseitIdError) throw new Error(`Failed to get ParseIt ID: ${parseitIdError.message}`);

              parseitId = newParseitId;

              if (extractionType.parseit_id_mapping && parseitId) {
                finalDataToSend = injectParseitId(JSON.parse(extractedContent), extractionType.parseit_id_mapping, parseitId);
                finalDataToSend = JSON.stringify(finalDataToSend, null, 2);
              }

              if (!apiConfig || !apiConfig.path || !extractionType.json_path) {
                throw new Error('API configuration incomplete for JSON extraction');
              }

              const apiUrl = apiConfig.path.endsWith('/')
                ? `${apiConfig.path.slice(0, -1)}${extractionType.json_path}`
                : `${apiConfig.path}${extractionType.json_path}`;

              console.log('Sending to API URL:', apiUrl);
              console.log('Final JSON being sent (first 1000 chars):', finalDataToSend.substring(0, 1000));

              const headers = {
                'Content-Type': 'application/json'
              };

              if (apiConfig.password) {
                headers['Authorization'] = `Bearer ${apiConfig.password}`;
              }

              const apiResponse = await fetch(apiUrl, {
                method: 'POST',
                headers,
                body: finalDataToSend
              });

              if (!apiResponse.ok) {
                const errorDetails = await apiResponse.text();
                throw new Error(`API call failed: ${apiResponse.status} ${apiResponse.statusText} - ${errorDetails}`);
              }

              const apiResponseData = await apiResponse.json();
              console.log('API call successful:', apiResponseData);

              await supabase
                .from('extraction_logs')
                .update({
                  api_response: JSON.stringify(apiResponseData),
                  api_status_code: apiResponse.status,
                  extracted_data: finalDataToSend,
                  extraction_status: 'success'
                })
                .eq('id', extractionLogId);

              if (sftpConfig) {
                await uploadToSftp(sftpConfig, pageData.base64, pageData.filename, extractionType.filename, extractionType.id, null, parseitId, supabase);
                console.log('PDF uploaded to SFTP for JSON type');
              } else {
                console.warn('SFTP config missing, skipping PDF upload for JSON type');
              }

              processedSuccessfully = true;
              console.log('Email attachment processed successfully via direct API');
            } else {
              console.log('No workflow assigned, using direct SFTP processing for XML');

              if (!sftpConfig) {
                throw new Error('SFTP configuration incomplete for XML extraction');
              }

              finalDataToSend = extractedContent.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, (parseitId || '').toString());

              await uploadToSftp(sftpConfig, pageData.base64, pageData.filename, extractionType.filename, extractionType.id, finalDataToSend, null, supabase);
              console.log('XML and PDF uploaded to SFTP');

              await supabase
                .from('extraction_logs')
                .update({
                  extracted_data: finalDataToSend,
                  extraction_status: 'success'
                })
                .eq('id', extractionLogId);

              processedSuccessfully = true;
              console.log('Email attachment processed successfully via direct SFTP');
            }

            await applyPostProcessAction(config, 'office365', email.id, accessToken, config.monitored_email, 'success');

          } catch (processError) {
            console.error('Error processing attachment:', processError);
            errorMessage = processError.message || 'Unknown processing error';

            if (extractionLogId) {
              await supabase
                .from('extraction_logs')
                .update({
                  extraction_status: 'failed',
                  error_message: errorMessage
                })
                .eq('id', extractionLogId);
            }

            await applyPostProcessAction(config, 'office365', email.id, accessToken, config.monitored_email, 'failure');
          }
          }
        }

      } catch (emailError) {
        console.error('Error handling email:', emailError);
        errorMessage = emailError.message || 'Unknown email handling error';
      } finally {
        processedEmailsResults.push({
          id: email.id,
          from: fromEmail,
          subject: subject,
          receivedDate: receivedDate,
          processedSuccessfully,
          errorMessage,
          extractionLogId,
          rule: matchingRule?.rule_name || 'No rule matched'
        });

        await supabase
          .from('processed_emails')
          .insert({
            email_id: email.id,
            sender: fromEmail,
            subject: subject,
            received_date: receivedDate,
            processing_rule_id: matchingRule?.id || null,
            extraction_type_id: matchingRule?.extraction_types?.id || null,
            pdf_filename: attachments[0]?.filename || null,
            attachment_count: attachments.length,
            pdf_filenames: attachments.map(a => a.filename).join(', ') || null,
            attachment_page_counts: attachments.map(a => a.pageCount || 1).join(', ') || null,
            processing_status: processedSuccessfully ? 'completed' : 'failed',
            error_message: errorMessage,
            parseit_id: parseitId || null,
            processed_at: new Date().toISOString()
          });
      }
    }

    return processedEmailsResults;
  } catch (error) {
    console.error('Office365 processing error:', error);
    throw error;
  }
}

function findMatchingRule(fromEmail, subject, rules) {
  for (const rule of rules) {
    const senderMatches = !rule.sender_pattern || 
      fromEmail.toLowerCase().includes(rule.sender_pattern.toLowerCase());
    
    const subjectMatches = !rule.subject_pattern || 
      subject.toLowerCase().includes(rule.subject_pattern.toLowerCase());
    
    if (senderMatches && subjectMatches) {
      return rule;
    }
  }
  return null;
}

async function findPdfAttachmentsGmail(payload, accessToken, messageId) {
  const attachments = [];

  const findAttachments = (part) => {
    if (part.parts) {
      part.parts.forEach(findAttachments);
    } else if (part.filename && part.filename.toLowerCase().endsWith('.pdf') && part.body.attachmentId) {
      attachments.push({
        filename: part.filename,
        attachmentId: part.body.attachmentId
      });
    }
  };

  findAttachments(payload);

  const downloadedAttachments = [];
  for (const attachment of attachments) {
    try {
      const attachmentResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachment.attachmentId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (attachmentResponse.ok) {
        const attachmentData = await attachmentResponse.json();
        const base64Data = attachmentData.data.replace(/-/g, '+').replace(/_/g, '/');

        let pageCount = 1;
        try {
          const pdfBuffer = Buffer.from(base64Data, 'base64');
          const pdfDoc = await PDFDocument.load(pdfBuffer);
          pageCount = pdfDoc.getPageCount();
        } catch (pdfError) {
          console.warn('Could not determine PDF page count:', pdfError.message);
        }

        downloadedAttachments.push({
          filename: attachment.filename,
          base64: base64Data,
          pageCount
        });
      }
    } catch (error) {
      console.error('Error downloading Gmail attachment:', error);
    }
  }

  return downloadedAttachments;
}

async function findPdfAttachmentsOffice365(userEmail, messageId, accessToken) {
  const attachments = [];

  try {
    const attachmentsResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}/attachments`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (attachmentsResponse.ok) {
      const attachmentsData = await attachmentsResponse.json();

      for (const attachment of attachmentsData.value) {
        if (attachment.name && attachment.name.toLowerCase().endsWith('.pdf')) {
          let pageCount = 1;
          try {
            const pdfBuffer = Buffer.from(attachment.contentBytes, 'base64');
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            pageCount = pdfDoc.getPageCount();
          } catch (pdfError) {
            console.warn('Could not determine PDF page count:', pdfError.message);
          }

          attachments.push({
            filename: attachment.name,
            base64: attachment.contentBytes,
            pageCount
          });
        }
      }
    }
  } catch (error) {
    console.error('Error fetching Office365 attachments:', error);
  }

  return attachments;
}

async function moveGmailMessageToLabel(messageId, accessToken, labelName) {
  try {
    const labelsResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!labelsResponse.ok) {
      console.warn('Could not fetch Gmail labels');
      return;
    }
    
    const labelsData = await labelsResponse.json();
    let targetLabel = labelsData.labels.find(label => label.name === labelName);
    
    if (!targetLabel) {
      const createLabelResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        })
      });
      
      if (createLabelResponse.ok) {
        targetLabel = await createLabelResponse.json();
      } else {
        console.warn('Could not create Gmail label:', labelName);
        return;
      }
    }
    
    await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        addLabelIds: [targetLabel.id],
        removeLabelIds: ['INBOX']
      })
    });
    
    console.log(`Moved Gmail message to ${labelName}`);
  } catch (error) {
    console.warn('Could not move Gmail message to label:', error);
  }
}

async function uploadToSftp(sftpConfig, base64Data, originalFilename, extractionTypeFilename, extractionTypeId, xmlData, parseitId, supabase) {
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sftp-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sftpConfig,
        base64Data,
        originalFilename,
        extractionTypeFilename,
        extractionTypeId,
        xmlData,
        parseitId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SFTP upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log('SFTP upload successful:', result);
    return result;
  } catch (error) {
    console.error('SFTP upload error:', error);
    throw error;
  }
}

function injectParseitId(jsonData, parseitIdMapping, parseitId) {
  try {
    const mappingPath = parseitIdMapping.split('.');
    let current = jsonData;
    
    for (let i = 0; i < mappingPath.length - 1; i++) {
      const key = mappingPath[i];
      if (key === '[]' && Array.isArray(current) && current.length > 0) {
        current = current[0];
      } else if (current[key]) {
        current = current[key];
      } else {
        console.warn('Could not navigate to parseit ID mapping path:', parseitIdMapping);
        return jsonData;
      }
    }
    
    const finalKey = mappingPath[mappingPath.length - 1];
    current[finalKey] = parseitId;
    
    return jsonData;
  } catch (error) {
    console.error('Error injecting ParseIt ID:', error);
    return jsonData;
  }
}

function applyValidationFixes(jsonString) {
  try {
    let parsed = JSON.parse(jsonString);

    const fixObject = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(fixObject);
      } else if (obj && typeof obj === 'object') {
        const fixed = {};
        for (const [key, value] of Object.entries(obj)) {
          fixed[key] = fixObject(value);
        }
        return fixed;
      } else if (typeof obj === 'string') {
        if (obj === 'N/A' || obj === 'n/a' || obj === 'null') {
          return '';
        }
        return obj;
      }
      return obj;
    };

    parsed = fixObject(parsed);
    return JSON.stringify(parsed, null, 2);
  } catch (error) {
    console.warn('Could not apply validation fixes:', error);
    return jsonString;
  }
}

async function executeWorkflowForEmail(workflowId, extractedData, extractionType, attachment, pageCount, supabase, senderEmail, extractionLogId = null, workflowOnlyDataStr = '{}') {
  console.log('Executing workflow for email attachment:', {
    workflowId,
    extractionType: extractionType.name,
    filename: attachment.filename,
    senderEmail: senderEmail,
    extractionLogId: extractionLogId,
    hasWFOData: workflowOnlyDataStr !== '{}'
  });

  const formatType = extractionType.format_type || 'JSON';
  const processorEndpoint = formatType === 'CSV' ? 'csv-workflow-processor' : 'json-workflow-processor';

  let parsedWfoData = {};
  try {
    parsedWfoData = typeof workflowOnlyDataStr === 'string' ? JSON.parse(workflowOnlyDataStr) : workflowOnlyDataStr;
  } catch (e) {
    console.warn('Failed to parse workflowOnlyData, using empty object:', e);
    parsedWfoData = {};
  }

  const workflowRequest = {
    extractedData: typeof extractedData === 'string' ? JSON.parse(extractedData) : extractedData,
    workflowOnlyData: parsedWfoData,
    workflowId: workflowId,
    userId: null,
    extractionTypeId: extractionType.id,
    extractionLogId: extractionLogId,
    pdfFilename: attachment.filename,
    pdfPages: pageCount,
    pdfBase64: attachment.base64,
    originalPdfFilename: attachment.filename,
    formatType: formatType,
    extractionTypeFilename: extractionType.filename,
    senderEmail: senderEmail || null,
    triggerSource: 'email_monitoring'
  };

  console.log('Calling workflow processor:', processorEndpoint);

  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/${processorEndpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(workflowRequest)
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Workflow execution failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  console.log('Workflow execution completed:', {
    success: result.success,
    workflowExecutionLogId: result.workflowExecutionLogId
  });

  return result;
}

async function applyPostProcessAction(config, provider, messageId, accessToken, userEmail, processResult = 'success') {
  const action = processResult === 'success'
    ? (config.post_process_action || 'mark_read')
    : (config.post_process_action_on_failure || 'none');

  const folderPath = processResult === 'success'
    ? (config.processed_folder_path || 'Processed')
    : (config.failure_folder_path || 'Failed');

  console.log(`Applying ${processResult} post-process action: ${action} for ${provider}`);

  if (action === 'none') {
    console.log('Post-process action is "none", skipping');
    return;
  }

  try {
    if (provider === 'gmail') {
      await applyGmailPostProcessAction(messageId, accessToken, action, folderPath);
    } else if (provider === 'office365') {
      await applyOffice365PostProcessAction(messageId, accessToken, userEmail, action, folderPath);
    }
    console.log(`Post-process action "${action}" completed successfully`);
  } catch (error) {
    console.warn(`Post-process action "${action}" failed:`, error.message);
  }
}

async function applyGmailPostProcessAction(messageId, accessToken, action, folderPath) {
  switch (action) {
    case 'mark_read':
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          removeLabelIds: ['UNREAD']
        })
      });
      break;

    case 'move':
      await moveGmailMessageToLabel(messageId, accessToken, folderPath);
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          removeLabelIds: ['UNREAD']
        })
      });
      break;

    case 'archive':
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          removeLabelIds: ['INBOX', 'UNREAD']
        })
      });
      break;

    case 'delete':
      await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      break;
  }
}

async function applyOffice365PostProcessAction(messageId, accessToken, userEmail, action, folderPath) {
  switch (action) {
    case 'mark_read':
      await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isRead: true
        })
      });
      break;

    case 'move':
      const foldersResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/mailFolders`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const foldersData = await foldersResponse.json();
      let targetFolder = foldersData.value?.find(f => f.displayName === folderPath);

      if (!targetFolder) {
        const createFolderResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/mailFolders`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ displayName: folderPath })
        });
        if (createFolderResponse.ok) {
          targetFolder = await createFolderResponse.json();
        }
      }

      if (targetFolder) {
        await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}/move`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ destinationId: targetFolder.id })
        });
      }

      await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isRead: true })
      });
      break;

    case 'archive':
      const archiveFoldersResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/mailFolders`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const archiveFoldersData = await archiveFoldersResponse.json();
      const archiveFolder = archiveFoldersData.value?.find(f => f.displayName === 'Archive');

      if (archiveFolder) {
        await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}/move`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ destinationId: archiveFolder.id })
        });
      }

      await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isRead: true })
      });
      break;

    case 'delete':
      const deletedFoldersResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/mailFolders`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const deletedFoldersData = await deletedFoldersResponse.json();
      const deletedFolder = deletedFoldersData.value?.find(f => f.displayName === 'Deleted Items');

      if (deletedFolder) {
        await fetch(`https://graph.microsoft.com/v1.0/users/${userEmail}/messages/${messageId}/move`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ destinationId: deletedFolder.id })
        });
      }
      break;
  }
}

const getActiveModelName = async () => 'gemini-2.5-pro';