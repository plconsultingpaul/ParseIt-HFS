import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, EmailMonitoringConfig, EmailProcessingRule, ProcessedEmail, ExtractionLog, User, UserPermissions } from '../types';

export function useSupabaseData() {
  const [extractionTypes, setExtractionTypes] = useState<ExtractionType[]>([]);
  const [sftpConfig, setSftpConfig] = useState<SftpConfig>({
    host: '',
    port: 22,
    username: '',
    password: '',
    xmlPath: '/uploads/xml/',
    pdfPath: '/uploads/pdf/',
    jsonPath: '/uploads/json/'
  });
  const [settingsConfig, setSettingsConfig] = useState<SettingsConfig>({
    geminiApiKey: ''
  });
  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    path: '',
    password: '',
    googleApiKey: ''
  });
  const [loading, setLoading] = useState(true);
  const [emailConfig, setEmailConfig] = useState<EmailMonitoringConfig>({
    tenantId: '',
    clientId: '',
    clientSecret: '',
    monitoredEmail: '',
    pollingInterval: 5,
    isEnabled: false
  });
  const [emailRules, setEmailRules] = useState<EmailProcessingRule[]>([]);
  const [processedEmails, setProcessedEmails] = useState<ProcessedEmail[]>([]);
  const [extractionLogs, setExtractionLogs] = useState<ExtractionLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load extraction types
      const { data: extractionTypesData, error: extractionError } = await supabase
        .from('extraction_types')
        .select('*')
        .order('created_at', { ascending: true });

      if (extractionError) throw extractionError;

      // Transform database format to app format
      const transformedTypes: ExtractionType[] = (extractionTypesData || []).map(type => ({
        id: type.id,
        name: type.name,
        defaultInstructions: type.default_instructions,
        formatTemplate: type.xml_format,
        filename: type.filename || '',
        fieldMappings: type.field_mappings ? JSON.parse(type.field_mappings).map((mapping: any) => ({
          ...mapping,
          dataType: mapping.dataType || 'string' // Default to string for existing mappings
        })) : [],
        formatType: type.format_type || 'XML',
        jsonPath: type.json_path || '',
        parseitIdMapping: type.parseit_id_mapping || '',
        traceTypeMapping: type.trace_type_mapping || '',
        traceTypeValue: type.trace_type_value || ''
      }));

      setExtractionTypes(transformedTypes);

      // Load SFTP config
      const { data: sftpData, error: sftpError } = await supabase
        .from('sftp_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (sftpError) {
        throw sftpError;
      }

      if (sftpData && sftpData.length > 0) {
        const config = sftpData[0]; // Use the most recently updated config
        setSftpConfig({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          xmlPath: config.remote_path || '/uploads/xml/',
          pdfPath: config.pdf_path || '/uploads/pdf/',
          jsonPath: config.json_path || '/uploads/json/'
        });
      }

      // Load settings config
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (settingsError) {
        throw settingsError;
      }

      if (settingsData && settingsData.length > 0) {
        const config = settingsData[0];
        setSettingsConfig({
          geminiApiKey: config.gemini_api_key || ''
        });
      }

      // Load API config
      const { data: apiData, error: apiError } = await supabase
        .from('api_settings')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (apiError) {
        throw apiError;
      }

      if (apiData && apiData.length > 0) {
        const config = apiData[0];
        setApiConfig({
          path: config.path,
          password: config.password,
          googleApiKey: config.google_api_key || ''
        });
      }

      // Load email monitoring config
      const { data: emailData, error: emailError } = await supabase
        .from('email_monitoring_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (emailError) {
        throw emailError;
      }

      if (emailData && emailData.length > 0) {
        const config = emailData[0];
        setEmailConfig({
          tenantId: config.tenant_id,
          clientId: config.client_id,
          clientSecret: config.client_secret,
          monitoredEmail: config.monitored_email,
          pollingInterval: config.polling_interval,
          isEnabled: config.is_enabled,
          lastCheck: config.last_check
        });
      }

      // Load email processing rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('email_processing_rules')
        .select('*')
        .order('priority', { ascending: true });

      if (rulesError) {
        throw rulesError;
      }

      if (rulesData) {
        const transformedRules: EmailProcessingRule[] = rulesData.map(rule => ({
          id: rule.id,
          ruleName: rule.rule_name,
          senderPattern: rule.sender_pattern,
          subjectPattern: rule.subject_pattern,
          extractionTypeId: rule.extraction_type_id,
          isEnabled: rule.is_enabled,
          priority: rule.priority
        }));
        setEmailRules(transformedRules);
      }

      // Load processed emails (recent ones)
      const { data: emailsData, error: emailsError } = await supabase
        .from('processed_emails')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (emailsError) {
        throw emailsError;
      }

      if (emailsData) {
        const transformedEmails: ProcessedEmail[] = emailsData.map(email => ({
          id: email.id,
          emailId: email.email_id,
          sender: email.sender,
          subject: email.subject,
          receivedDate: email.received_date,
          processingRuleId: email.processing_rule_id,
          extractionTypeId: email.extraction_type_id,
          pdfFilename: email.pdf_filename,
          processingStatus: email.processing_status,
          errorMessage: email.error_message,
          parseitId: email.parseit_id,
          processedAt: email.processed_at
        }));
        setProcessedEmails(transformedEmails);
      }

      // Load extraction logs (recent ones)
      const { data: logsData, error: logsError } = await supabase
        .from('extraction_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) {
        console.error('Error loading extraction logs:', logsError);
        // Don't throw error, just log it and continue with empty array
      }

      if (logsData) {
        const transformedLogs: ExtractionLog[] = logsData.map(log => ({
          id: log.id,
          userId: log.user_id,
          extractionTypeId: log.extraction_type_id,
          pdfFilename: log.pdf_filename,
          pdfPages: log.pdf_pages,
          extractionStatus: log.extraction_status,
          errorMessage: log.error_message,
          createdAt: log.created_at,
          apiResponse: log.api_response,
          apiStatusCode: log.api_status_code,
          apiError: log.api_error,
          extractedData: log.extracted_data
        }));
        setExtractionLogs(transformedLogs);
      } else {
        setExtractionLogs([]);
      }

      // Load users for extraction logs
      try {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username, is_admin, is_active, permissions')
          .order('created_at', { ascending: false });

        if (usersError) {
          console.error('Error loading users:', usersError);
        } else if (usersData) {
          const transformedUsers: User[] = usersData.map(user => ({
            id: user.id,
            username: user.username,
            isAdmin: user.is_admin,
            isActive: user.is_active,
            permissions: user.permissions ? JSON.parse(user.permissions) : getDefaultPermissions(user.is_admin)
          }));
          setUsers(transformedUsers);
        }
      } catch (error) {
        console.error('Error loading users:', error);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateExtractionTypes = async (types: ExtractionType[]) => {
    try {
      // Get current types from database
      const { data: currentTypes } = await supabase
        .from('extraction_types')
        .select('id');

      const currentIds = new Set((currentTypes || []).map(t => t.id));
      const newIds = new Set(types.map(t => t.id));

      // Delete removed types
      const toDelete = [...currentIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        await supabase
          .from('extraction_types')
          .delete()
          .in('id', toDelete);
      }

      // Separate new and existing types
      const newTypes = types.filter(type => type.id.startsWith('temp-'));
      const existingTypes = types.filter(type => !type.id.startsWith('temp-'));

      let allUpdatedTypes: ExtractionType[] = [];

      // Insert new types
      if (newTypes.length > 0) {
        const insertData = newTypes.map(type => ({
          name: type.name,
          default_instructions: type.defaultInstructions,
          xml_format: type.formatTemplate,
          filename: type.filename,
          format_type: type.formatType,
          json_path: type.jsonPath,
          parseit_id_mapping: type.parseitIdMapping || null,
          user_id: null,
          updated_at: new Date().toISOString()
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from('extraction_types')
          .insert(insertData)
          .select();

        if (insertError) throw insertError;

        const insertedTypes: ExtractionType[] = (insertedData || []).map(type => ({
          id: type.id,
          name: type.name,
          defaultInstructions: type.default_instructions,
          formatTemplate: type.xml_format,
          filename: type.filename || '',
          formatType: type.format_type || 'XML',
          jsonPath: type.json_path || ''
        }));

        allUpdatedTypes.push(...insertedTypes);
      }

      // Update existing types
      if (existingTypes.length > 0) {
        const updateData = existingTypes.map(type => ({
          id: type.id,
          name: type.name,
          default_instructions: type.defaultInstructions,
          xml_format: type.formatTemplate,
          filename: type.filename,
          format_type: type.formatType,
          json_path: type.jsonPath,
          field_mappings: type.fieldMappings ? JSON.stringify(type.fieldMappings) : null,
          parseit_id_mapping: type.parseitIdMapping || null,
          trace_type_mapping: type.traceTypeMapping || null,
          trace_type_value: type.traceTypeValue || null,
          user_id: null,
          updated_at: new Date().toISOString()
        }));

        const { data: updatedData, error: updateError } = await supabase
          .from('extraction_types')
          .upsert(updateData, { onConflict: 'id' })
          .select();

        if (updateError) throw updateError;

        const updatedExistingTypes: ExtractionType[] = (updatedData || []).map(type => ({
          id: type.id,
          name: type.name,
          defaultInstructions: type.default_instructions,
          formatTemplate: type.xml_format,
          filename: type.filename || '',
          formatType: type.format_type || 'XML',
          jsonPath: type.json_path || '',
          fieldMappings: type.field_mappings ? JSON.parse(type.field_mappings) : undefined,
          parseitIdMapping: type.parseit_id_mapping || '',
          traceTypeMapping: type.trace_type_mapping || '',
          traceTypeValue: type.trace_type_value || ''
        }));

        allUpdatedTypes.push(...updatedExistingTypes);
      }

      setExtractionTypes(allUpdatedTypes);
    } catch (error) {
      console.error('Error updating extraction types:', error);
      throw error;
    }
  };

  const updateSftpConfig = async (config: SftpConfig) => {
    try {
      // Delete all existing SFTP configurations first
      const { error: deleteError } = await supabase
        .from('sftp_config')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (deleteError) {
        console.warn('Warning: Could not delete old SFTP configs:', deleteError);
      }

      // Insert the new configuration
      const { error } = await supabase
        .from('sftp_config')
        .insert({
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          remote_path: config.xmlPath,
          pdf_path: config.pdfPath,
          json_path: config.jsonPath,
          user_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSftpConfig(config);
    } catch (error) {
      console.error('Error updating SFTP config:', error);
      throw error;
    }
  };

  const updateSettingsConfig = async (config: SettingsConfig) => {
    try {
      // Delete all existing settings configurations first
      const { error: deleteError } = await supabase
        .from('settings_config')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (deleteError) {
        console.warn('Warning: Could not delete old settings configs:', deleteError);
      }

      // Insert the new configuration
      const { error } = await supabase
        .from('settings_config')
        .insert({
          gemini_api_key: config.geminiApiKey || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSettingsConfig(config);
    } catch (error) {
      console.error('Error updating settings config:', error);
      throw error;
    }
  };

  const updateApiConfig = async (config: ApiConfig) => {
    try {
      // Delete all existing API configurations first
      const { error: deleteError } = await supabase
        .from('api_settings')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (deleteError) {
        console.warn('Warning: Could not delete old API configs:', deleteError);
      }

      // Insert the new configuration
      const { error } = await supabase
        .from('api_settings')
        .insert({
          path: config.path,
          password: config.password,
          google_api_key: config.googleApiKey,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setApiConfig(config);
    } catch (error) {
      console.error('Error updating API config:', error);
      throw error;
    }
  };

  const updateEmailConfig = async (config: EmailMonitoringConfig) => {
    try {
      // Delete all existing email monitoring configurations first
      const { error: deleteError } = await supabase
        .from('email_monitoring_config')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

      if (deleteError) {
        console.warn('Warning: Could not delete old email configs:', deleteError);
      }

      // Insert the new configuration
      const { error } = await supabase
        .from('email_monitoring_config')
        .insert({
          tenant_id: config.tenantId,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          monitored_email: config.monitoredEmail,
          polling_interval: config.pollingInterval,
          is_enabled: config.isEnabled,
          last_check: config.lastCheck || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setEmailConfig(config);
    } catch (error) {
      console.error('Error updating email config:', error);
      throw error;
    }
  };

  const updateEmailRules = async (rules: EmailProcessingRule[]) => {
    try {
      // Utility function to check if a string is a valid UUID
      const isValidUuid = (str: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      // Get current rules from database
      const { data: currentRules } = await supabase
        .from('email_processing_rules')
        .select('id');

      const currentIds = new Set((currentRules || []).map(r => r.id));
      const newIds = new Set(rules.map(r => r.id));

      // Delete removed rules
      const toDelete = [...currentIds].filter(id => !newIds.has(id));
      if (toDelete.length > 0) {
        await supabase
          .from('email_processing_rules')
          .delete()
          .in('id', toDelete);
      }

      // Separate new and existing rules - treat invalid UUIDs as new rules
      const newRules = rules.filter(rule => rule.id.startsWith('temp-') || !isValidUuid(rule.id));
      const existingRules = rules.filter(rule => !rule.id.startsWith('temp-') && isValidUuid(rule.id));

      let allUpdatedRules: EmailProcessingRule[] = [];

      // Insert new rules
      if (newRules.length > 0) {
        const insertData = newRules.map(rule => ({
          rule_name: rule.ruleName,
          sender_pattern: rule.senderPattern,
          subject_pattern: rule.subjectPattern,
          extraction_type_id: rule.extractionTypeId || null,
          is_enabled: rule.isEnabled,
          priority: rule.priority,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from('email_processing_rules')
          .insert(insertData)
          .select();

        if (insertError) throw insertError;

        const insertedRules: EmailProcessingRule[] = (insertedData || []).map(rule => ({
          id: rule.id,
          ruleName: rule.rule_name,
          senderPattern: rule.sender_pattern,
          subjectPattern: rule.subject_pattern,
          extractionTypeId: rule.extraction_type_id,
          isEnabled: rule.is_enabled,
          priority: rule.priority
        }));

        allUpdatedRules.push(...insertedRules);
      }

      // Update existing rules
      if (existingRules.length > 0) {
        const updateData = existingRules.map(rule => ({
          id: rule.id,
          rule_name: rule.ruleName,
          sender_pattern: rule.senderPattern,
          subject_pattern: rule.subjectPattern,
          extraction_type_id: rule.extractionTypeId || null,
          is_enabled: rule.isEnabled,
          priority: rule.priority,
          updated_at: new Date().toISOString()
        }));

        const { data: updatedData, error: updateError } = await supabase
          .from('email_processing_rules')
          .upsert(updateData, { onConflict: 'id' })
          .select();

        if (updateError) throw updateError;

        const updatedExistingRules: EmailProcessingRule[] = (updatedData || []).map(rule => ({
          id: rule.id,
          ruleName: rule.rule_name,
          senderPattern: rule.sender_pattern,
          subjectPattern: rule.subject_pattern,
          extractionTypeId: rule.extraction_type_id,
          isEnabled: rule.is_enabled,
          priority: rule.priority
        }));

        allUpdatedRules.push(...updatedExistingRules);
      }

      setEmailRules(allUpdatedRules);
    } catch (error) {
      console.error('Error updating email rules:', error);
      throw error;
    }
  };

  const logExtraction = async (
    userId: string,
    extractionTypeId: string,
    pdfFilename: string,
    pdfPages: number,
    status: 'success' | 'failed',
    errorMessage?: string
  ) => {
    try {
      const { error } = await supabase
        .from('extraction_logs')
        .insert({
          user_id: userId,
          extraction_type_id: extractionTypeId,
          pdf_filename: pdfFilename,
          pdf_pages: pdfPages,
          extraction_status: status,
          error_message: errorMessage || null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Refresh logs after adding new one
      await loadData();
    } catch (error) {
      console.error('Error logging extraction:', error);
      // Don't throw error here as logging shouldn't break the main flow
    }
  };

  return {
    extractionTypes,
    sftpConfig,
    settingsConfig,
    apiConfig,
    emailConfig,
    emailRules,
    processedEmails,
    extractionLogs,
    users,
    loading,
    updateExtractionTypes,
    updateSftpConfig,
    updateSettingsConfig,
    updateApiConfig,
    updateEmailConfig,
    updateEmailRules,
    logExtraction,
    refreshData: loadData,
    refreshLogs: async () => {
      try {
        // Load only extraction logs (recent ones) - this will be replaced by filtered query
        const { data: logsData, error: logsError } = await supabase
          .from('extraction_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (logsError) {
          console.error('Error loading extraction logs:', logsError);
          // Don't throw error, just log it and continue with empty array
        }

        if (logsData) {
          const transformedLogs: ExtractionLog[] = logsData.map(log => ({
            id: log.id,
            userId: log.user_id,
            extractionTypeId: log.extraction_type_id,
            pdfFilename: log.pdf_filename,
            pdfPages: log.pdf_pages,
            extractionStatus: log.extraction_status,
            errorMessage: log.error_message,
            createdAt: log.created_at,
            apiResponse: log.api_response,
            apiStatusCode: log.api_status_code,
            apiError: log.api_error,
            extractedData: log.extracted_data
          }));
          setExtractionLogs(transformedLogs);
        } else {
          setExtractionLogs([]);
        }
      } catch (error) {
        console.error('Error refreshing extraction logs:', error);
        throw error;
      }
    },
    refreshLogsWithFilters: async (filters: {
      statusFilter?: string;
      userFilter?: string;
      typeFilter?: string;
      fromDate?: string;
      toDate?: string;
    }) => {
      try {
        console.log('Applying filters:', filters);
        
        let query = supabase
          .from('extraction_logs')
          .select('*')
          .order('created_at', { ascending: false });

        // Apply filters to the query
        if (filters.statusFilter && filters.statusFilter !== 'all') {
          console.log('Adding status filter:', filters.statusFilter);
          query = query.eq('extraction_status', filters.statusFilter);
        }

        if (filters.userFilter && filters.userFilter !== 'all') {
          console.log('Adding user filter:', filters.userFilter);
          query = query.eq('user_id', filters.userFilter);
        }

        if (filters.typeFilter && filters.typeFilter !== 'all') {
          console.log('Adding type filter:', filters.typeFilter);
          query = query.eq('extraction_type_id', filters.typeFilter);
        }

        if (filters.fromDate) {
          console.log('Adding from date filter:', filters.fromDate);
          // Convert date to start of day timestamp
          const fromDateTime = `${filters.fromDate}T00:00:00.000Z`;
          query = query.gte('created_at', fromDateTime);
        }

        if (filters.toDate) {
          console.log('Adding to date filter:', filters.toDate);
          // Convert date to end of day timestamp
          const toDateTime = `${filters.toDate}T23:59:59.999Z`;
          query = query.lte('created_at', toDateTime);
        }

        // Limit results to prevent performance issues
        query = query.limit(1000);

        console.log('Executing query...');
        const { data: logsData, error: logsError } = await query;

        console.log('Query result:', { data: logsData, error: logsError });
        
        if (logsError) {
          console.error('Error loading filtered extraction logs:', logsError);
          throw logsError;
        }

        if (logsData) {
          const transformedLogs: ExtractionLog[] = logsData.map(log => ({
            id: log.id,
            userId: log.user_id,
            extractionTypeId: log.extraction_type_id,
            pdfFilename: log.pdf_filename,
            pdfPages: log.pdf_pages,
            extractionStatus: log.extraction_status,
            errorMessage: log.error_message,
            createdAt: log.created_at,
            apiResponse: log.api_response,
            apiStatusCode: log.api_status_code,
            apiError: log.api_error,
            extractedData: log.extracted_data
          }));
          console.log('Transformed logs count:', transformedLogs.length);
          setExtractionLogs(transformedLogs);
          return transformedLogs;
        } else {
          console.log('No data returned from query');
          setExtractionLogs([]);
          return [];
        }
      } catch (error) {
        console.error('Error refreshing filtered extraction logs:', error);
        throw error;
      }
    }
  };
}

function getDefaultPermissions(isAdmin: boolean): UserPermissions {
  if (isAdmin) {
    return {
      extractionTypes: true,
      sftp: true,
      api: true,
      emailMonitoring: true,
      emailRules: true,
      processedEmails: true,
      extractionLogs: true,
      userManagement: true
    };
  }
  
  return {
    extractionTypes: false,
    sftp: false,
    api: false,
    emailMonitoring: false,
    emailRules: false,
    processedEmails: false,
    extractionLogs: false,
    userManagement: false
  };
}