import { supabase } from '../lib/supabase';
import type { EmailMonitoringConfig, EmailProcessingRule } from '../types';

// Email Monitoring Configuration
export async function fetchEmailConfig(): Promise<EmailMonitoringConfig> {
  try {
    const { data, error } = await supabase
      .from('email_monitoring_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const config = data[0];
      return {
        provider: config.provider || 'office365',
        tenantId: config.tenant_id || '',
        clientId: config.client_id || '',
        clientSecret: config.client_secret || '',
        monitoredEmail: config.monitored_email || '',
        gmailClientId: config.gmail_client_id || '',
        gmailClientSecret: config.gmail_client_secret || '',
        gmailRefreshToken: config.gmail_refresh_token || '',
        gmailMonitoredLabel: config.gmail_monitored_label || 'INBOX',
        pollingInterval: config.polling_interval || 5,
        isEnabled: config.is_enabled || false,
        enableAutoDetect: config.enable_auto_detect || false,
        lastCheck: config.last_check
      };
    }

    return {
      provider: 'office365',
      tenantId: '',
      clientId: '',
      clientSecret: '',
      monitoredEmail: '',
      gmailClientId: '',
      gmailClientSecret: '',
      gmailRefreshToken: '',
      gmailMonitoredLabel: 'INBOX',
      pollingInterval: 5,
      isEnabled: false,
      enableAutoDetect: false
    };
  } catch (error) {
    console.error('Error fetching email config:', error);
    throw error;
  }
}

export async function updateEmailConfig(config: EmailMonitoringConfig): Promise<void> {
  try {
    const { data: existingData } = await supabase
      .from('email_monitoring_config')
      .select('id')
      .limit(1);

    const configData = {
      provider: config.provider,
      tenant_id: config.tenantId,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      monitored_email: config.monitoredEmail,
      gmail_client_id: config.gmailClientId,
      gmail_client_secret: config.gmailClientSecret,
      gmail_refresh_token: config.gmailRefreshToken,
      gmail_monitored_label: config.gmailMonitoredLabel,
      polling_interval: config.pollingInterval,
      is_enabled: config.isEnabled,
      enable_auto_detect: config.enableAutoDetect,
      updated_at: new Date().toISOString()
    };

    if (existingData && existingData.length > 0) {
      const { error } = await supabase
        .from('email_monitoring_config')
        .update(configData)
        .eq('id', existingData[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('email_monitoring_config')
        .insert([configData]);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating email config:', error);
    throw error;
  }
}

// Email Processing Rules
export async function fetchEmailRules(): Promise<EmailProcessingRule[]> {
  try {
    const { data, error } = await supabase
      .from('email_processing_rules')
      .select('*')
      .order('priority', { ascending: true });

    if (error) throw error;

    return (data || []).map(rule => ({
      id: rule.id,
      ruleName: rule.rule_name,
      senderPattern: rule.sender_pattern,
      subjectPattern: rule.subject_pattern,
      extractionTypeId: rule.extraction_type_id,
      transformationTypeId: rule.transformation_type_id,
      processingMode: rule.processing_mode,
      isEnabled: rule.is_enabled,
      priority: rule.priority
    }));
  } catch (error) {
    console.error('Error fetching email rules:', error);
    throw error;
  }
}

export async function updateEmailRules(rules: EmailProcessingRule[]): Promise<void> {
  try {
    // Delete all existing rules
    const { error: deleteError } = await supabase
      .from('email_processing_rules')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) throw deleteError;

    // Insert new rules
    if (rules.length > 0) {
      const { error: insertError } = await supabase
        .from('email_processing_rules')
        .insert(
          rules.map(rule => ({
            rule_name: rule.ruleName,
            sender_pattern: rule.senderPattern,
            subject_pattern: rule.subjectPattern,
            extraction_type_id: rule.extractionTypeId,
            transformation_type_id: rule.transformationTypeId,
            processing_mode: rule.processingMode,
            is_enabled: rule.isEnabled,
            priority: rule.priority
          }))
        );

      if (insertError) throw insertError;
    }
  } catch (error) {
    console.error('Error updating email rules:', error);
    throw error;
  }
}