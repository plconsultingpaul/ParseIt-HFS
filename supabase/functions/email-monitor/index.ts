import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.24.1';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { Buffer } from 'node:buffer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  console.log('🚀 Email monitor function started');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let pollingLogId = null;
  let emailsCheckedCount = 0;
  let emailsProcessedCount = 0;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Helper function to fetch active Gemini model
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
          console.log('✅ Using active Gemini model:', activeModelData.model_name);
          return activeModelData.model_name;
        }
      }

      console.log('ℹ️ No active model configuration found, using default: gemini-2.5-pro');
      return 'gemini-2.5-pro';
    } catch (error) {
      console.error('⚠️ Failed to fetch active model configuration:', error);
      return 'gemini-2.5-pro';
    }
  };

  // Helper function to update polling log
  const updatePollingLog = async (updates) => {
    console.log('📝 Updating polling log with:', updates);
    if (!pollingLogId) {
      console.error('❌ No polling log ID available for update');
      return;
    }

    const { error: updateError } = await supabase
      .from('email_polling_logs')
      .update(updates)
      .eq('id', pollingLogId);

    if (updateError) {
      console.error('❌ Failed to update polling log:', updateError);
    } else {
      console.log('✅ Successfully updated polling log');
    }
  };

  try {
    console.log('📊 Creating initial polling log entry');
    
    // Create initial polling log entry
    const { data: logData, error: logError } = await supabase
      .from('email_polling_logs')
      .insert({
        provider: 'office365', // Will be updated with correct provider
        status: 'running',
        emails_found: 0,
        emails_processed: 0
      })
      .select()
      .single();

    if (logError) {
      console.error('❌ Failed to create polling log:', logError);
      throw logError;
    }

    pollingLogId = logData.id;
    console.log('✅ Created polling log with ID:', pollingLogId);

    console.log('🔍 Fetching email monitoring configuration');
    
    // Get email monitoring configuration
    const { data: config, error: configError } = await supabase
      .from('email_monitoring_config')
      .select('*')
      .single();

    if (configError) {
      console.error('❌ Failed to fetch email monitoring config:', configError);
      await updatePollingLog({
        status: 'failed',
        error_message: `Failed to fetch config: ${configError.message}`,
        execution_time_ms: Date.now() - startTime
      });
      throw configError;
    }

    console.log('📧 Email monitoring config loaded, provider:', config.provider);

    // Update log with correct provider
    await updatePollingLog({
      provider: config.provider
    });

    if (!config.is_enabled) {
      console.log('⏸️ Email monitoring is disabled');
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

    console.log('📋 Fetching email processing rules and extraction types');
    
    // Get email processing rules with joined extraction types
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
          trace_type_value
        )
      `)
      .eq('is_enabled', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('❌ Failed to fetch processing rules:', rulesError);
      await updatePollingLog({
        status: 'failed',
        error_message: `Failed to fetch rules: ${rulesError.message}`,
        execution_time_ms: Date.now() - startTime
      });
      throw rulesError;
    }

    console.log('📊 Found', rules?.length || 0, 'active processing rules');

    console.log('⚙️ Fetching SFTP and API configurations');
    
    const { data: sftpConfigData, error: sftpConfigError } = await supabase
      .from('sftp_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (sftpConfigError) {
      console.warn('⚠️ Could not fetch SFTP config:', sftpConfigError.message);
    }

    const sftpConfig = sftpConfigData || null;

    const { data: apiConfigData, error: apiConfigError } = await supabase
      .from('api_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (apiConfigError) {
      console.warn('⚠️ Could not fetch API config:', apiConfigError.message);
    }

    const apiConfig = apiConfigData || null;

    const { data: activeKeyData, error: keyError } = await supabase
      .from('gemini_api_keys')
      .select('id, api_key')
      .eq('is_active', true)
      .maybeSingle();

    if (keyError) {
      console.error('❌ Error fetching Gemini API key:', keyError.message);
    }

    if (!activeKeyData) {
      console.error('❌ No active Gemini API key found. Please configure in Settings → Gemini Configuration.');
    }

    const geminiApiKey = activeKeyData?.api_key || '';

    let emails = [];
    if (config.provider === 'gmail') {
      console.log('📬 Processing Gmail emails');
      emails = await processGmailEmails(config, rules || [], sftpConfig, apiConfig, geminiApiKey, supabase);
    } else if (config.provider === 'office365') {
      console.log('📬 Processing Office365 emails');
      emails = await processOffice365Emails(config, rules || [], sftpConfig, apiConfig, geminiApiKey, supabase);
    } else {
      console.error('❌ Unsupported email provider:', config.provider);
      await updatePollingLog({
        status: 'failed',
        error_message: `Unsupported provider: ${config.provider}`,
        execution_time_ms: Date.now() - startTime
      });
      throw new Error(`Unsupported email provider: ${config.provider}`);
    }

    emailsCheckedCount = emails.length;
    emailsProcessedCount = emails.filter(e => e.processedSuccessfully).length;

    console.log('📊 Email processing completed. Found:', emailsCheckedCount, 'emails. Processed:', emailsProcessedCount);

    // Update last check time
    await supabase
      .from('email_monitoring_config')
      .update({ last_check: new Date().toISOString() })
      .eq('id', config.id);

    // Final log update
    await updatePollingLog({
      status: 'success',
      emails_found: emailsCheckedCount,
      emails_processed: emailsProcessedCount,
      execution_time_ms: Date.now() - startTime
    });

    console.log('✅ Email monitoring completed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: `Email monitoring completed. Processed ${emailsProcessedCount} emails.`,
      emailsChecked: emailsCheckedCount,
      emailsProcessed: emailsProcessedCount,
      results: [] // Changed to empty array to avoid sending large email objects in response
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Email monitor function error:', error);
    
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
  console.log('📧 Starting Gmail email processing');
  
  try {
    // Get access token using refresh token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.gmail_client_id,
        client_secret: config.gmail_client_secret,
        refresh_token: config.gmail_refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Failed to refresh Gmail token:', errorText);
      throw new Error(`Failed to refresh Gmail access token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Gmail access token refreshed successfully');

    // Build search query
    let query = `has:attachment`;
    
    // Add label filter
    if (config.gmail_monitored_label && config.gmail_monitored_label !== 'INBOX') {
      query += ` label:${config.gmail_monitored_label}`;
    } else {
      query += ` in:inbox`;
    }

    if (config.last_check) {
      const lastCheckDate = new Date(config.last_check);
      const timestamp = Math.floor(lastCheckDate.getTime() / 1000);
      query += ` after:${timestamp}`;
    }

    console.log('🔍 Gmail search query:', query);

    // Search for emails
    const searchResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('❌ Gmail search failed:', errorText);
      throw new Error(`Failed to search Gmail messages: ${errorText}`);
    }

    const searchData = await searchResponse.json();
    const messages = searchData.messages || [];
    console.log('📊 Found', messages.length, 'Gmail messages');

    const processedEmailsResults = [];

    for (const message of messages) {
      // Declare variables at the beginning of the loop scope
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
        console.log('📧 Processing Gmail message:', message.id);

        // Get full message details
        const messageResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!messageResponse.ok) {
          const errorText = await messageResponse.text();
          console.error('❌ Failed to fetch message details:', errorText);
          throw new Error(`Failed to fetch message details: ${errorText}`);
        }

        const messageData = await messageResponse.json();

        // Extract email details
        const headers = messageData.payload.headers;
        subject = headers.find(h => h.name === 'Subject')?.value || '';
        const fromHeader = headers.find(h => h.name === 'From')?.value || '';
        receivedDate = headers.find(h => h.name === 'Date')?.value || '';

        // Extract just the email address from the "From" header
        const fromMatch = fromHeader.match(/<([^>]+)>/);
        fromEmail = fromMatch ? fromMatch[1] : fromHeader;

        console.log('📧 Email details - From:', fromEmail, 'Subject:', subject);

        // Check for PDF attachments and download them
        attachments = await findPdfAttachmentsGmail(messageData.payload, accessToken, message.id);
        console.log('📎 PDF attachment detection result:', {
          attachmentCount: attachments.length,
          filenames: attachments.map(att => att.filename)
        });

        if (attachments.length === 0) {
          console.log('⏭️ No PDF attachments found, skipping');
          errorMessage = 'No PDF attachments found';
          continue; // Skip to next email if no PDFs
        }

        console.log('📎 Found', attachments.length, 'PDF attachments');

        // Find matching rule
        matchingRule = findMatchingRule(fromEmail, subject, rules);
        console.log('🔍 Rule matching result:', {
          ruleFound: !!matchingRule,
          ruleName: matchingRule?.rule_name || 'None',
          totalRulesAvailable: rules.length
        });

        if (!matchingRule) {
          console.log('⏭️ No matching processing rule found, skipping');
          errorMessage = 'No matching processing rule found';
          continue; // Skip to next email if no rule matches
        }

        console.log('✅ Found matching rule:', matchingRule.rule_name);

        const extractionType = matchingRule.extraction_types;
        console.log('🎯 Extraction type check:', {
          extractionTypeFound: !!extractionType,
          extractionTypeName: extractionType?.name || 'None',
          extractionTypeId: extractionType?.id || 'None'
        });
        
        if (!extractionType) {
          console.error('❌ Extraction type not found for rule:', matchingRule.rule_name);
          errorMessage = `Extraction type not found for rule: ${matchingRule.rule_name}`;
          continue;
        }

        // Process each PDF attachment
        for (const attachment of attachments) {
          console.log('🔄 Starting to process PDF attachment:', {
            filename: attachment.filename,
            sizeKB: Math.round(attachment.base64.length * 0.75 / 1024), // Approximate size from base64
            extractionType: extractionType.name
          });
          
          try {
            // Create initial extraction log entry
            const { data: newLog, error: logInsertError } = await supabase
              .from('extraction_logs')
              .insert({
                user_id: null,
                extraction_type_id: extractionType.id,
                pdf_filename: attachment.filename,
                pdf_pages: 0,
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
              console.error('❌ Failed to create extraction log:', logInsertError);
              throw new Error(`Failed to create extraction log: ${logInsertError.message}`);
            }

            extractionLogId = newLog.id;

            const pdfBuffer = Buffer.from(attachment.base64, 'base64');
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pageCount = pdfDoc.getPageCount();

            // Update log with page count
            await supabase
              .from('extraction_logs')
              .update({ pdf_pages: pageCount })
              .eq('id', extractionLogId);

            // --- AI Extraction ---
            const modelName = await getActiveModelName();
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ model: modelName });

            const fullInstructions = extractionType.default_instructions;
            const isJsonFormat = extractionType.format_type === 'JSON';
            const outputFormat = isJsonFormat ? 'JSON' : 'XML';
            const templateLabel = isJsonFormat ? 'JSON structure' : 'XML template structure';

            const prompt = `
You are a data extraction AI. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}

OUTPUT FORMAT:
Please format the extracted data as ${outputFormat} following this EXACT ${templateLabel} structure:
${extractionType.xml_format}

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
                  data: attachment.base64
                }
              },
              prompt
            ]);

            let extractedContent = result.response.text();

            // Clean up the response - remove any markdown formatting
            if (isJsonFormat) {
              extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              
              console.log('🔍 Raw extracted data before validation:', extractedContent.substring(0, 500) + '...');
              
              // Post-process JSON to fix validation issues
              try {
                console.log('🔧 Applying validation fixes to JSON data...');
                extractedContent = applyValidationFixes(extractedContent);
                console.log('✅ Validation fixes applied. Final data preview:', extractedContent.substring(0, 500) + '...');
              } catch (parseError) {
                console.warn('⚠️ Could not parse JSON for validation fixes:', parseError);
                // Continue with original content if parsing fails
              }
              
              // Basic JSON validation
              try {
                JSON.parse(extractedContent);
              } catch (e) {
                throw new Error('AI returned invalid JSON format');
              }
            } else {
              extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();
              
              // Basic XML validation
              if (!extractedContent.startsWith('<') || !extractedContent.endsWith('>')) {
                throw new Error('AI returned invalid XML format');
              }
            }

            // --- SFTP/API Upload ---
            let finalDataToSend = extractedContent;

            if (isJsonFormat) {
              // Get ParseIt ID
              const { data: newParseitId, error: parseitIdError } = await supabase.rpc('get_next_parseit_id');
              if (parseitIdError) throw new Error(`Failed to get ParseIt ID: ${parseitIdError.message}`);
              
              parseitId = newParseitId;

              // Inject ParseIt ID into JSON
              if (extractionType.parseit_id_mapping && parseitId) {
                finalDataToSend = injectParseitId(JSON.parse(extractedContent), extractionType.parseit_id_mapping, parseitId);
                finalDataToSend = JSON.stringify(finalDataToSend, null, 2);
              }

              // Send to API
              if (!apiConfig || !apiConfig.path || !extractionType.json_path) {
                throw new Error('API configuration incomplete for JSON extraction');
              }

              const apiUrl = apiConfig.path.endsWith('/') 
                ? `${apiConfig.path.slice(0, -1)}${extractionType.json_path}`
                : `${apiConfig.path}${extractionType.json_path}`;

              console.log('🌐 Sending to API URL:', apiUrl);
              console.log('📤 Final JSON being sent (first 1000 chars):', finalDataToSend.substring(0, 1000));

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
              console.log('✅ API call successful:', apiResponseData);

              // Log API response
              await supabase
                .from('extraction_logs')
                .update({
                  api_response: JSON.stringify(apiResponseData),
                  api_status_code: apiResponse.status,
                  extracted_data: finalDataToSend,
                  extraction_status: 'success'
                })
                .eq('id', extractionLogId);

              // Upload PDF to SFTP for JSON types (archival)
              if (sftpConfig) {
                await uploadToSftp(sftpConfig, attachment.base64, attachment.filename, extractionType.filename, extractionType.id, null, parseitId, supabase);
                console.log('✅ PDF uploaded to SFTP for JSON type');
              } else {
                console.warn('⚠️ SFTP config missing, skipping PDF upload for JSON type');
              }
            } else {
              if (!sftpConfig) {
                throw new Error('SFTP configuration incomplete for XML extraction');
              }

              // Inject ParseIt ID into XML
              finalDataToSend = extractedContent.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, (parseitId || '').toString());

              await uploadToSftp(sftpConfig, attachment.base64, attachment.filename, extractionType.filename, extractionType.id, finalDataToSend, null, supabase);
              console.log('✅ XML and PDF uploaded to SFTP');

              await supabase
                .from('extraction_logs')
                .update({
                  extracted_data: finalDataToSend,
                  extraction_status: 'success'
                })
                .eq('id', extractionLogId);
            }

            processedSuccessfully = true;
            console.log('✅ Email attachment processed successfully');

            // Move email to archive label in Gmail
            await moveGmailMessageToLabel(message.id, accessToken, 'ParseIt/Processed');

          } catch (processError) {
            console.error('❌ Error processing attachment:', processError);
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
          }
        }

      } catch (emailError) {
        console.error('❌ Error handling email:', emailError);
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

        // Log processed email to processed_emails table
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
            processing_status: processedSuccessfully ? 'completed' : 'failed',
            error_message: errorMessage,
            parseit_id: parseitId || null,
            processed_at: new Date().toISOString()
          });
      }
    }

    return processedEmailsResults;
  } catch (error) {
    console.error('❌ Gmail processing error:', error);
    throw error;
  }
}

async function processOffice365Emails(config, rules, sftpConfig, apiConfig, geminiApiKey, supabase) {
  console.log('📧 Starting Office365 email processing');
  
  try {
    // Get access token
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: config.client_id,
        client_secret: config.client_secret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Failed to get Office365 token:', errorText);
      throw new Error(`Failed to get Office365 access token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('✅ Office365 access token obtained successfully');

    // Build filter for emails with attachments
    let filter = 'hasAttachments eq true';
    if (config.last_check) {
      const lastCheckDate = new Date(config.last_check).toISOString();
      filter += ` and receivedDateTime gt ${lastCheckDate}`;
    }

    console.log('🔍 Office365 filter:', filter);

    // Get emails
    const emailsResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${config.monitored_email}/messages?$filter=${encodeURIComponent(filter)}&$select=id,subject,from,receivedDateTime,hasAttachments`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!emailsResponse.ok) {
      const errorText = await emailsResponse.text();
      console.error('❌ Office365 emails fetch failed:', errorText);
      throw new Error(`Failed to fetch Office365 emails: ${errorText}`);
    }

    const emailsData = await emailsResponse.json();
    const emails = emailsData.value || [];
    console.log('📊 Found', emails.length, 'Office365 emails');

    const processedEmailsResults = [];

    for (const email of emails) {
      // Declare variables at the beginning of the loop scope
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
        console.log('📧 Processing Office365 email:', email.id);

        subject = email.subject || '';
        fromEmail = email.from?.emailAddress?.address || '';
        receivedDate = email.receivedDateTime || '';

        console.log('📧 Email details - From:', fromEmail, 'Subject:', subject);

        // Get attachments and download them
        attachments = await findPdfAttachmentsOffice365(config.monitored_email, email.id, accessToken);
        console.log('📎 PDF attachment detection result:', {
          attachmentCount: attachments.length,
          filenames: attachments.map(att => att.filename)
        });

        if (attachments.length === 0) {
          console.log('⏭️ No PDF attachments found, skipping');
          errorMessage = 'No PDF attachments found';
          continue; // Skip to next email if no PDFs
        }

        console.log('📎 Found', attachments.length, 'PDF attachments');

        // Find matching rule
        matchingRule = findMatchingRule(fromEmail, subject, rules);
        console.log('🔍 Rule matching result:', {
          ruleFound: !!matchingRule,
          ruleName: matchingRule?.rule_name || 'None',
          totalRulesAvailable: rules.length
        });

        if (!matchingRule) {
          console.log('⏭️ No matching processing rule found, skipping');
          errorMessage = 'No matching processing rule found';
          continue; // Skip to next email if no rule matches
        }

        console.log('✅ Found matching rule:', matchingRule.rule_name);

        const extractionType = matchingRule.extraction_types;
        console.log('🎯 Extraction type check:', {
          extractionTypeFound: !!extractionType,
          extractionTypeName: extractionType?.name || 'None',
          extractionTypeId: extractionType?.id || 'None'
        });
        
        if (!extractionType) {
          console.error('❌ Extraction type not found for rule:', matchingRule.rule_name);
          errorMessage = `Extraction type not found for rule: ${matchingRule.rule_name}`;
          continue;
        }

        // Process each PDF attachment
        for (const attachment of attachments) {
          console.log('🔄 Starting to process PDF attachment:', {
            filename: attachment.filename,
            sizeKB: Math.round(attachment.base64.length * 0.75 / 1024), // Approximate size from base64
            extractionType: extractionType.name
          });
          
          try {
            // Create initial extraction log entry
            const { data: newLog, error: logInsertError } = await supabase
              .from('extraction_logs')
              .insert({
                user_id: null,
                extraction_type_id: extractionType.id,
                pdf_filename: attachment.filename,
                pdf_pages: 0,
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
              console.error('❌ Failed to create extraction log:', logInsertError);
              throw new Error(`Failed to create extraction log: ${logInsertError.message}`);
            }

            extractionLogId = newLog.id;

            const pdfBuffer = Buffer.from(attachment.base64, 'base64');
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const pageCount = pdfDoc.getPageCount();

            // Update log with page count
            await supabase
              .from('extraction_logs')
              .update({ pdf_pages: pageCount })
              .eq('id', extractionLogId);

            // --- AI Extraction ---
            const modelName = await getActiveModelName();
            const genAI = new GoogleGenerativeAI(geminiApiKey);
            const model = genAI.getGenerativeModel({ model: modelName });

            const fullInstructions = extractionType.default_instructions;
            const isJsonFormat = extractionType.format_type === 'JSON';
            const outputFormat = isJsonFormat ? 'JSON' : 'XML';
            const templateLabel = isJsonFormat ? 'JSON structure' : 'XML template structure';

            const prompt = `
You are a data extraction AI. Please analyze the provided PDF document and extract the requested information according to the following instructions:

EXTRACTION INSTRUCTIONS:
${fullInstructions}

OUTPUT FORMAT:
Please format the extracted data as ${outputFormat} following this EXACT ${templateLabel} structure:
${extractionType.xml_format}

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
                  data: attachment.base64
                }
              },
              prompt
            ]);

            let extractedContent = result.response.text();

            // Clean up the response - remove any markdown formatting
            if (isJsonFormat) {
              extractedContent = extractedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              
              console.log('🔍 Raw extracted data before validation:', extractedContent.substring(0, 500) + '...');
              
              // Post-process JSON to fix validation issues
              try {
                console.log('🔧 Applying validation fixes to JSON data...');
                extractedContent = applyValidationFixes(extractedContent);
                console.log('✅ Validation fixes applied. Final data preview:', extractedContent.substring(0, 500) + '...');
              } catch (parseError) {
                console.warn('⚠️ Could not parse JSON for validation fixes:', parseError);
                // Continue with original content if parsing fails
              }
              
              // Basic JSON validation
              try {
                JSON.parse(extractedContent);
              } catch (e) {
                throw new Error('AI returned invalid JSON format');
              }
            } else {
              extractedContent = extractedContent.replace(/```xml\n?/g, '').replace(/```\n?/g, '').trim();
              
              // Basic XML validation
              if (!extractedContent.startsWith('<') || !extractedContent.endsWith('>')) {
                throw new Error('AI returned invalid XML format');
              }
            }

            // --- SFTP/API Upload ---
            let finalDataToSend = extractedContent;

            if (isJsonFormat) {
              // Get ParseIt ID
              const { data: newParseitId, error: parseitIdError } = await supabase.rpc('get_next_parseit_id');
              if (parseitIdError) throw new Error(`Failed to get ParseIt ID: ${parseitIdError.message}`);
              
              parseitId = newParseitId;

              // Inject ParseIt ID into JSON
              if (extractionType.parseit_id_mapping && parseitId) {
                finalDataToSend = injectParseitId(JSON.parse(extractedContent), extractionType.parseit_id_mapping, parseitId);
                finalDataToSend = JSON.stringify(finalDataToSend, null, 2);
              }

              // Send to API
              if (!apiConfig || !apiConfig.path || !extractionType.json_path) {
                throw new Error('API configuration incomplete for JSON extraction');
              }

              const apiUrl = apiConfig.path.endsWith('/') 
                ? `${apiConfig.path.slice(0, -1)}${extractionType.json_path}`
                : `${apiConfig.path}${extractionType.json_path}`;

              console.log('🌐 Sending to API URL:', apiUrl);
              console.log('📤 Final JSON being sent (first 1000 chars):', finalDataToSend.substring(0, 1000));

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
              console.log('✅ API call successful:', apiResponseData);

              // Log API response
              await supabase
                .from('extraction_logs')
                .update({
                  api_response: JSON.stringify(apiResponseData),
                  api_status_code: apiResponse.status,
                  extracted_data: finalDataToSend,
                  extraction_status: 'success'
                })
                .eq('id', extractionLogId);

              // Upload PDF to SFTP for JSON types (archival)
              if (sftpConfig) {
                await uploadToSftp(sftpConfig, attachment.base64, attachment.filename, extractionType.filename, extractionType.id, null, parseitId, supabase);
                console.log('✅ PDF uploaded to SFTP for JSON type');
              } else {
                console.warn('⚠️ SFTP config missing, skipping PDF upload for JSON type');
              }
            } else {
              if (!sftpConfig) {
                throw new Error('SFTP configuration incomplete for XML extraction');
              }

              // Inject ParseIt ID into XML
              finalDataToSend = extractedContent.replace(/{{PARSEIT_ID_PLACEHOLDER}}/g, (parseitId || '').toString());

              await uploadToSftp(sftpConfig, attachment.base64, attachment.filename, extractionType.filename, extractionType.id, finalDataToSend, null, supabase);
              console.log('✅ XML and PDF uploaded to SFTP');

              await supabase
                .from('extraction_logs')
                .update({
                  extracted_data: finalDataToSend,
                  extraction_status: 'success'
                })
                .eq('id', extractionLogId);
            }

            processedSuccessfully = true;
            console.log('✅ Email attachment processed successfully');

            // Move email to archive label in Office365 (if supported)
            // Note: Office365 doesn't have the same label system as Gmail
            // This would require additional implementation for folder management

          } catch (processError) {
            console.error('❌ Error processing attachment:', processError);
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
          }
        }

      } catch (emailError) {
        console.error('❌ Error handling email:', emailError);
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

        // Log processed email to processed_emails table
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
            processing_status: processedSuccessfully ? 'completed' : 'failed',
            error_message: errorMessage,
            parseit_id: parseitId || null,
            processed_at: new Date().toISOString()
          });
      }
    }

    return processedEmailsResults;
  } catch (error) {
    console.error('❌ Office365 processing error:', error);
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
  
  // Download each PDF attachment
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
        downloadedAttachments.push({
          filename: attachment.filename,
          base64: attachmentData.data.replace(/-/g, '+').replace(/_/g, '/')
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
          attachments.push({
            filename: attachment.name,
            base64: attachment.contentBytes
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
    // First, try to find or create the label
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
      // Create the label if it doesn't exist
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
    
    // Move message to the label
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
    
    console.log(`✅ Moved Gmail message to ${labelName}`);
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
    console.log('✅ SFTP upload successful:', result);
    return result;
  } catch (error) {
    console.error('❌ SFTP upload error:', error);
    throw error;
  }
}

function injectParseitId(jsonData, parseitIdMapping, parseitId) {
  try {
    const mappingPath = parseitIdMapping.split('.');
    let current = jsonData;
    
    // Navigate to the parent object
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
    
    // Set the parseit ID
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
    
    // Apply validation fixes recursively
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
        // Fix common string issues
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
      