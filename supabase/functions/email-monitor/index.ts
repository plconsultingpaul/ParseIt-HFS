import { corsHeaders, createSupabaseClient, getActiveGeminiApiKey, getActiveModelName } from './config.ts';
import { EmailProvider, findMatchingRule, getPostProcessAction } from './lib/services/email-base.ts';

export interface FieldMapping {
  fieldName: string;
  type: 'hardcoded' | 'mapped' | 'ai';
  value?: string;
  dataType?: string;
  maxLength?: number;
  removeIfNull?: boolean;
  isWorkflowOnly?: boolean;
}

export interface ArraySplitConfig {
  targetArrayField: string;
  splitBasedOnField: string;
  splitStrategy: 'one_per_entry' | 'divide_evenly';
  defaultToOneIfMissing?: boolean;
}

export interface ArrayEntryField {
  fieldName: string;
  fieldType: 'hardcoded' | 'extracted' | 'mapped';
  hardcodedValue?: string;
  extractionInstruction?: string;
  dataType?: 'string' | 'number' | 'integer' | 'datetime';
  maxLength?: number;
  removeIfNull?: boolean;
}

export interface ArrayEntryConfig {
  targetArrayField: string;
  entryOrder: number;
  isEnabled: boolean;
  fields: ArrayEntryField[];
  isRepeating?: boolean;
  repeatInstruction?: string;
  aiConditionInstruction?: string;
}

export interface SplitPageResult {
  filename: string;
  base64: string;
  pageNumber: number;
  originalFilename: string;
}

export interface PdfAttachment {
  filename: string;
  base64: string;
  pageCount: number;
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  receivedDate: string;
}

export interface ProcessedEmailResult {
  id: string;
  from: string;
  subject: string;
  receivedDate: string;
  processedSuccessfully: boolean;
  errorMessage: string | null;
  extractionLogId: string | null;
  rule: string;
}

export interface ProcessingRule {
  id: string;
  rule_name: string;
  sender_pattern: string | null;
  subject_pattern: string | null;
  extraction_type_id: string;
  is_enabled: boolean;
  priority: number;
  extraction_types: ExtractionType | null;
}

export interface ExtractionType {
  id: string;
  name: string;
  default_instructions: string;
  xml_format: string;
  filename: string;
  format_type: 'JSON' | 'XML' | 'CSV';
  auto_detect_instructions?: string;
  json_path?: string;
  field_mappings?: FieldMapping[] | string;
  parseit_id_mapping?: string;
  trace_type_mapping?: string;
  trace_type_value?: string;
  workflow_id?: string;
  json_multi_page_processing?: boolean;
  extraction_type_array_splits?: ArraySplitConfig[];
  extraction_type_array_entries?: ArrayEntryConfig[];
}

export interface EmailMonitoringConfig {
  id: string;
  provider: 'gmail' | 'office365';
  is_enabled: boolean;
  last_check?: string;
  check_all_messages?: boolean;
  monitored_email?: string;
  gmail_client_id?: string;
  gmail_client_secret?: string;
  gmail_refresh_token?: string;
  gmail_monitoring_client_id?: string;
  gmail_monitoring_client_secret?: string;
  gmail_monitoring_refresh_token?: string;
  gmail_monitored_label?: string;
  tenant_id?: string;
  client_id?: string;
  client_secret?: string;
  monitoring_tenant_id?: string;
  monitoring_client_id?: string;
  monitoring_client_secret?: string;
  post_process_action?: string;
  post_process_action_on_failure?: string;
  processed_folder_path?: string;
  failure_folder_path?: string;
}

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  path?: string;
  csv_path?: string;
}

export interface ApiConfig {
  path: string;
  password?: string;
}

export interface WorkflowResult {
  success: boolean;
  error?: string;
  lastApiResponse?: any;
  workflowExecutionLogId?: string;
}

export interface ExtractionContext {
  config: EmailMonitoringConfig;
  rules: ProcessingRule[];
  sftpConfig: SftpConfig | null;
  apiConfig: ApiConfig | null;
  geminiApiKey: string;
}

export interface EmailProviderCredentials {
  accessToken: string;
}
import { GmailProvider } from './lib/services/gmail.ts';
import { Office365Provider } from './lib/services/office365.ts';
import { GeminiService, parseFieldMappings, parseArraySplitConfigs, parseArrayEntryConfigs } from './lib/services/gemini.ts';
import { LoggingService } from './lib/services/logging.ts';
import { executeWorkflowForEmail, uploadToSftp, sendToDirectApi, getParseitId } from './lib/services/workflow.ts';
import { splitPdfIntoPages } from './lib/pdf.ts';
import { injectParseitId } from './lib/utils.ts';

Deno.serve(async (req) => {
  console.log('Email monitor function started');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createSupabaseClient();
  const logger = new LoggingService(supabase);

  let emailsCheckedCount = 0;
  let emailsProcessedCount = 0;
  let emailsFailedCount = 0;

  try {
    console.log('Creating initial polling log entry');
    await logger.createPollingLog('office365');

    const { data: config, error: configError } = await supabase
      .from('email_monitoring_config')
      .select('*')
      .single();

    if (configError) {
      console.error('Failed to fetch email monitoring config:', configError);
      await logger.markPollingFailed(`Failed to fetch config: ${configError.message}`);
      throw configError;
    }

    console.log('Email monitoring config loaded, provider:', config.provider);
    await logger.updatePollingLog({ provider: config.provider });

    if (!config.is_enabled) {
      console.log('Email monitoring is disabled');
      await logger.markPollingSuccess(0, 0, 0);
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
          ),
          extraction_type_array_entries (
            id,
            target_array_field,
            entry_order,
            is_enabled,
            is_repeating,
            repeat_instruction,
            extraction_type_array_entry_fields (
              id,
              field_name,
              field_type,
              hardcoded_value,
              extraction_instruction,
              data_type,
              field_order,
              remove_if_null
            )
          )
        )
      `)
      .eq('is_enabled', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('Failed to fetch processing rules:', rulesError);
      await logger.markPollingFailed(`Failed to fetch rules: ${rulesError.message}`);
      throw rulesError;
    }

    console.log('Found', rules?.length || 0, 'active processing rules');

    console.log('Fetching SFTP and API configurations');

    const { data: sftpConfigData } = await supabase
      .from('sftp_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    const sftpConfig: SftpConfig | null = sftpConfigData || null;

    const { data: apiConfigData } = await supabase
      .from('api_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    const apiConfig: ApiConfig | null = apiConfigData || null;

    const geminiApiKey = await getActiveGeminiApiKey(supabase);

    const provider: EmailProvider = config.provider === 'gmail'
      ? new GmailProvider(config)
      : new Office365Provider(config);

    console.log(`Processing ${provider.providerName} emails`);

    await provider.authenticate();

    const emails = await provider.fetchUnreadEmails();
    console.log('Found', emails.length, `${provider.providerName} emails`);

    const processedEmailsResults: ProcessedEmailResult[] = [];

    for (const email of emails) {
      const result = await processEmail(
        email.id,
        provider,
        rules || [],
        sftpConfig,
        apiConfig,
        geminiApiKey,
        supabase,
        logger,
        config
      );

      processedEmailsResults.push(result.emailResult);

      if (result.attachments.length > 0) {
        await logger.logProcessedEmail(
          result.emailResult,
          result.attachments,
          result.matchingRule,
          result.parseitId
        );
      }
    }

    emailsCheckedCount = processedEmailsResults.length;
    emailsProcessedCount = processedEmailsResults.filter(e => e.processedSuccessfully).length;
    emailsFailedCount = processedEmailsResults.filter(e => !e.processedSuccessfully && e.errorMessage).length;

    console.log('Email processing completed. Found:', emailsCheckedCount, 'emails. Processed:', emailsProcessedCount, 'Failed:', emailsFailedCount);

    await supabase
      .from('email_monitoring_config')
      .update({ last_check: new Date().toISOString() })
      .eq('id', config.id);

    await logger.markPollingSuccess(emailsCheckedCount, emailsProcessedCount, emailsFailedCount);

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

    if (logger.getPollingLogId()) {
      await logger.markPollingFailed((error as Error).message);
    }

    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      emailsChecked: emailsCheckedCount,
      emailsProcessed: emailsProcessedCount,
      results: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

interface ProcessEmailResult {
  emailResult: ProcessedEmailResult;
  attachments: PdfAttachment[];
  matchingRule: ProcessingRule | null;
  parseitId: number | null;
}

async function processEmail(
  emailId: string,
  provider: EmailProvider,
  rules: ProcessingRule[],
  sftpConfig: SftpConfig | null,
  apiConfig: ApiConfig | null,
  geminiApiKey: string,
  supabase: any,
  logger: LoggingService,
  config: any
): Promise<ProcessEmailResult> {
  let subject = '';
  let fromEmail = '';
  let receivedDate = '';
  let attachments: PdfAttachment[] = [];
  let matchingRule: ProcessingRule | null = null;
  let parseitId: number | null = null;
  let processedSuccessfully = false;
  let errorMessage: string | null = null;
  let extractionLogId: string | null = null;

  try {
    console.log('Processing email:', emailId);

    const details = await provider.getEmailDetails(emailId);
    subject = details.subject;
    fromEmail = details.from;
    receivedDate = details.receivedDate;

    console.log('Email details - From:', fromEmail, 'Subject:', subject);

    attachments = await provider.findPdfAttachments(emailId);
    console.log('PDF attachment detection result:', {
      attachmentCount: attachments.length,
      filenames: attachments.map(att => att.filename)
    });

    if (attachments.length === 0) {
      console.log('No PDF attachments found, skipping');
      return buildResult(emailId, fromEmail, subject, receivedDate, false, 'No PDF attachments found', null, [], null, null);
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
      return buildResult(emailId, fromEmail, subject, receivedDate, false, 'No matching processing rule found', null, attachments, null, null);
    }

    console.log('Found matching rule:', matchingRule.rule_name);

    const extractionType = matchingRule.extraction_types as ExtractionType | null;
    console.log('Extraction type check:', {
      extractionTypeFound: !!extractionType,
      extractionTypeName: extractionType?.name || 'None',
      extractionTypeId: extractionType?.id || 'None'
    });

    if (!extractionType) {
      console.error('Extraction type not found for rule:', matchingRule.rule_name);
      return buildResult(emailId, fromEmail, subject, receivedDate, false, `Extraction type not found for rule: ${matchingRule.rule_name}`, null, attachments, matchingRule, null);
    }

    for (const attachment of attachments) {
      const pageResult = await processAttachment(
        attachment,
        extractionType,
        geminiApiKey,
        sftpConfig,
        apiConfig,
        supabase,
        logger,
        fromEmail,
        provider,
        emailId,
        config
      );

      if (pageResult.success) {
        processedSuccessfully = true;
        extractionLogId = pageResult.extractionLogId;
        parseitId = pageResult.parseitId;
      } else {
        errorMessage = pageResult.error || 'Unknown processing error';
      }
    }

  } catch (emailError) {
    console.error('Error handling email:', emailError);
    errorMessage = (emailError as Error).message || 'Unknown email handling error';
  }

  return buildResult(
    emailId,
    fromEmail,
    subject,
    receivedDate,
    processedSuccessfully,
    errorMessage,
    extractionLogId,
    attachments,
    matchingRule,
    parseitId
  );
}

function buildResult(
  id: string,
  from: string,
  subject: string,
  receivedDate: string,
  processedSuccessfully: boolean,
  errorMessage: string | null,
  extractionLogId: string | null,
  attachments: PdfAttachment[],
  matchingRule: ProcessingRule | null,
  parseitId: number | null
): ProcessEmailResult {
  return {
    emailResult: {
      id,
      from,
      subject,
      receivedDate,
      processedSuccessfully,
      errorMessage,
      extractionLogId,
      rule: matchingRule?.rule_name || 'No rule matched'
    },
    attachments,
    matchingRule,
    parseitId
  };
}

interface AttachmentProcessResult {
  success: boolean;
  extractionLogId: string | null;
  parseitId: number | null;
  error?: string;
}

async function processAttachment(
  attachment: PdfAttachment,
  extractionType: ExtractionType,
  geminiApiKey: string,
  sftpConfig: SftpConfig | null,
  apiConfig: ApiConfig | null,
  supabase: any,
  logger: LoggingService,
  fromEmail: string,
  provider: EmailProvider,
  emailId: string,
  config: any
): Promise<AttachmentProcessResult> {
  console.log('Starting to process PDF attachment:', {
    filename: attachment.filename,
    sizeKB: Math.round(attachment.base64.length * 0.75 / 1024),
    extractionType: extractionType.name
  });

  const splitPages = await splitPdfIntoPages(attachment, extractionType);
  console.log(`PDF split into ${splitPages.length} page(s) for processing`);

  let lastExtractedLogId: string | null = null;
  let lastParseitId: number | null = null;
  let overallSuccess = false;
  let lastError: string | undefined;

  for (const pageData of splitPages) {
    const pageResult = await processPage(
      pageData,
      extractionType,
      geminiApiKey,
      sftpConfig,
      apiConfig,
      supabase,
      logger,
      fromEmail,
      provider,
      emailId,
      config
    );

    if (pageResult.success) {
      overallSuccess = true;
      lastExtractedLogId = pageResult.extractionLogId;
      lastParseitId = pageResult.parseitId;
    } else {
      lastError = pageResult.error;
    }
  }

  return {
    success: overallSuccess,
    extractionLogId: lastExtractedLogId,
    parseitId: lastParseitId,
    error: lastError
  };
}

async function processPage(
  pageData: { filename: string; base64: string; pageNumber: number; originalFilename: string },
  extractionType: ExtractionType,
  geminiApiKey: string,
  sftpConfig: SftpConfig | null,
  apiConfig: ApiConfig | null,
  supabase: any,
  logger: LoggingService,
  fromEmail: string,
  provider: EmailProvider,
  emailId: string,
  config: any
): Promise<AttachmentProcessResult> {
  let extractionLogId: string | null = null;
  let parseitId: number | null = null;

  try {
    extractionLogId = await logger.createExtractionLog(extractionType.id, pageData.filename);

    const modelName = await getActiveModelName(supabase);
    const gemini = new GeminiService(geminiApiKey, modelName);

    const fieldMappings = parseFieldMappings(extractionType);
    const arraySplitConfigs = parseArraySplitConfigs(extractionType);
    const arrayEntryConfigs = parseArrayEntryConfigs(extractionType);

    const extractionResult = await gemini.extractDataFromPdf(
      pageData.base64,
      extractionType,
      fieldMappings,
      arraySplitConfigs,
      arrayEntryConfigs
    );

    if (!extractionResult.isValid) {
      throw new Error(extractionResult.error || 'Extraction failed');
    }

    const isJsonFormat = extractionType.format_type === 'JSON';
    let finalDataToSend = extractionResult.extractedContent;

    if (extractionType.workflow_id) {
      console.log('Workflow assigned to extraction type, executing workflow:', extractionType.workflow_id);

      const pageAttachment = { filename: pageData.filename, base64: pageData.base64 };
      const workflowResult = await executeWorkflowForEmail(
        extractionType.workflow_id,
        extractionResult.extractedContent,
        extractionType,
        pageAttachment,
        1,
        supabase,
        fromEmail,
        extractionLogId,
        extractionResult.workflowOnlyData
      );

      await logger.updateExtractionLog(extractionLogId, {
        extracted_data: extractionResult.extractedContent,
        api_response: workflowResult.lastApiResponse ? JSON.stringify(workflowResult.lastApiResponse) : null,
        extraction_status: workflowResult.success ? 'success' : 'failed',
        error_message: workflowResult.error || null
      });

      if (!workflowResult.success) {
        throw new Error(workflowResult.error || 'Workflow execution failed');
      }

      console.log('Email attachment processed successfully via workflow');
    } else if (isJsonFormat) {
      console.log('No workflow assigned, using direct API/SFTP processing');

      parseitId = await getParseitId(supabase);

      if (extractionType.parseit_id_mapping && parseitId) {
        finalDataToSend = JSON.stringify(
          injectParseitId(JSON.parse(extractionResult.extractedContent), extractionType.parseit_id_mapping, parseitId),
          null,
          2
        );
      }

      if (!apiConfig || !apiConfig.path || !extractionType.json_path) {
        throw new Error('API configuration incomplete for JSON extraction');
      }

      const apiResult = await sendToDirectApi(extractionResult.extractedContent, extractionType, apiConfig, supabase);

      await logger.updateExtractionLog(extractionLogId, {
        api_response: JSON.stringify(apiResult.response),
        api_status_code: apiResult.statusCode,
        extracted_data: finalDataToSend,
        extraction_status: 'success'
      });

      if (sftpConfig) {
        await uploadToSftp(sftpConfig, pageData.base64, pageData.filename, extractionType.filename, extractionType.id, null, parseitId, supabase);
        console.log('PDF uploaded to SFTP for JSON type');
      } else {
        console.warn('SFTP config missing, skipping PDF upload for JSON type');
      }

      console.log('Email attachment processed successfully via direct API');
    } else {
      console.log('No workflow assigned, using direct SFTP processing for XML');

      if (!sftpConfig) {
        throw new Error('SFTP configuration incomplete for XML extraction');
      }

      finalDataToSend = extractionResult.extractedContent.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, (parseitId || '').toString());

      await uploadToSftp(sftpConfig, pageData.base64, pageData.filename, extractionType.filename, extractionType.id, finalDataToSend, null, supabase);
      console.log('XML and PDF uploaded to SFTP');

      await logger.updateExtractionLog(extractionLogId, {
        extracted_data: finalDataToSend,
        extraction_status: 'success'
      });

      console.log('Email attachment processed successfully via direct SFTP');
    }

    const { action, folderPath } = getPostProcessAction(config, 'success');
    await provider.applyPostProcessAction(emailId, action, folderPath);

    return {
      success: true,
      extractionLogId,
      parseitId
    };

  } catch (processError) {
    console.error('Error processing page:', processError);

    if (extractionLogId) {
      await logger.updateExtractionLog(extractionLogId, {
        extraction_status: 'failed',
        error_message: (processError as Error).message
      });
    }

    const { action, folderPath } = getPostProcessAction(config, 'failure');
    await provider.applyPostProcessAction(emailId, action, folderPath);

    return {
      success: false,
      extractionLogId,
      parseitId: null,
      error: (processError as Error).message
    };
  }
}
