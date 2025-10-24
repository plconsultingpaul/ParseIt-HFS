import { supabase } from '../lib/supabase';
import type { SftpConfig, SettingsConfig, ApiConfig, CompanyBranding } from '../types';

// API Configuration
export async function fetchApiConfig(): Promise<ApiConfig> {
  try {
    const { data, error } = await supabase
      .from('api_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const config = data[0];
      
      // Parse custom_order_display_fields to ensure it's always an array
      let customOrderDisplayFields = [];
      try {
        if (typeof config.custom_order_display_fields === 'string') {
          customOrderDisplayFields = JSON.parse(config.custom_order_display_fields);
        } else if (Array.isArray(config.custom_order_display_fields)) {
          customOrderDisplayFields = config.custom_order_display_fields;
        }
      } catch (error) {
        console.warn('Failed to parse custom_order_display_fields, defaulting to empty array:', error);
        customOrderDisplayFields = [];
      }
      
      // Ensure it's an array
      if (!Array.isArray(customOrderDisplayFields)) {
        customOrderDisplayFields = [];
      }
      
      return {
        path: config.path || '',
        password: config.password || '',
        googleApiKey: config.google_api_key || '',
        orderDisplayFields: config.order_display_fields || '',
        customOrderDisplayFields
      };
    }

    return {
      path: '',
      password: '',
      googleApiKey: '',
      orderDisplayFields: '',
      customOrderDisplayFields: []
    };
  } catch (error) {
    console.error('Error fetching API config:', error);
    throw error;
  }
}

export async function updateApiConfig(config: ApiConfig): Promise<void> {
  try {
    const { data: existingData } = await supabase
      .from('api_settings')
      .select('id')
      .limit(1);

    const configData = {
      path: config.path,
      password: config.password,
      google_api_key: config.googleApiKey,
      order_display_fields: config.orderDisplayFields,
      custom_order_display_fields: config.customOrderDisplayFields,
      updated_at: new Date().toISOString()
    };

    if (existingData && existingData.length > 0) {
      const { error } = await supabase
        .from('api_settings')
        .update(configData)
        .eq('id', existingData[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('api_settings')
        .insert([configData]);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating API config:', error);
    throw error;
  }
}

// SFTP Configuration
export async function fetchSftpConfig(): Promise<SftpConfig> {
  try {
    const { data, error } = await supabase
      .from('sftp_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const config = data[0];
      return {
        host: config.host || '',
        port: config.port || 22,
        username: config.username || '',
        password: config.password || '',
        xmlPath: config.remote_path || '/uploads/xml/',
        pdfPath: config.pdf_path || '/uploads/pdf/',
        jsonPath: config.json_path || '/uploads/json/',
        csvPath: config.csv_path || '/uploads/csv/'
      };
    }

    return {
      host: '',
      port: 22,
      username: '',
      password: '',
      xmlPath: '/uploads/xml/',
      pdfPath: '/uploads/pdf/',
      jsonPath: '/uploads/json/',
      csvPath: '/uploads/csv/'
    };
  } catch (error) {
    console.error('Error fetching SFTP config:', error);
    throw error;
  }
}

export async function updateSftpConfig(config: SftpConfig): Promise<void> {
  try {
    const { data: existingData } = await supabase
      .from('sftp_config')
      .select('id')
      .limit(1);

    const configData = {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      remote_path: config.xmlPath,
      pdf_path: config.pdfPath,
      json_path: config.jsonPath,
      csv_path: config.csvPath,
      updated_at: new Date().toISOString()
    };

    if (existingData && existingData.length > 0) {
      const { error } = await supabase
        .from('sftp_config')
        .update(configData)
        .eq('id', existingData[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('sftp_config')
        .insert([configData]);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating SFTP config:', error);
    throw error;
  }
}

// Settings Configuration
export async function fetchSettingsConfig(): Promise<SettingsConfig> {
  try {
    const { data, error } = await supabase
      .from('settings_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      return {
        password: data[0].password || '',
        geminiApiKey: data[0].gemini_api_key || ''
      };
    }

    return {
      password: '',
      geminiApiKey: ''
    };
  } catch (error) {
    console.error('Error fetching settings config:', error);
    throw error;
  }
}

export async function updateSettingsConfig(config: SettingsConfig): Promise<void> {
  try {
    const { data: existingData } = await supabase
      .from('settings_config')
      .select('id')
      .limit(1);

    const configData = {
      password: config.password,
      gemini_api_key: config.geminiApiKey,
      updated_at: new Date().toISOString()
    };

    if (existingData && existingData.length > 0) {
      const { error } = await supabase
        .from('settings_config')
        .update(configData)
        .eq('id', existingData[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('settings_config')
        .insert([configData]);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating settings config:', error);
    throw error;
  }
}

// Company Branding
export async function fetchCompanyBranding(): Promise<CompanyBranding> {
  try {
    const { data, error } = await supabase
      .from('company_branding')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const branding = data[0];
      return {
        id: branding.id,
        companyName: branding.company_name || '',
        logoUrl: branding.logo_url || '',
        showCompanyName: branding.show_company_name || false,
        createdAt: branding.created_at,
        updatedAt: branding.updated_at
      };
    }

    return {
      id: '',
      companyName: '',
      logoUrl: '',
      showCompanyName: false
    };
  } catch (error) {
    console.error('Error fetching company branding:', error);
    throw error;
  }
}

export async function updateCompanyBranding(branding: CompanyBranding): Promise<void> {
  try {
    const { data: existingData } = await supabase
      .from('company_branding')
      .select('id')
      .limit(1);

    const brandingData = {
      company_name: branding.companyName,
      logo_url: branding.logoUrl,
      show_company_name: branding.showCompanyName,
      updated_at: new Date().toISOString()
    };

    if (existingData && existingData.length > 0) {
      const { error } = await supabase
        .from('company_branding')
        .update(brandingData)
        .eq('id', existingData[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('company_branding')
        .insert([brandingData]);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating company branding:', error);
    throw error;
  }
}