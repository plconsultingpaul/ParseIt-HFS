import { supabase } from '../lib/supabase';
import type { SftpConfig, SettingsConfig, ApiConfig, CompanyBranding, SecondaryApiConfig } from '../types';

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
        googlePlacesApiKey: config.google_places_api_key || '',
        orderDisplayFields: config.order_display_fields || '',
        customOrderDisplayFields
      };
    }

    return {
      path: '',
      password: '',
      googleApiKey: '',
      googlePlacesApiKey: '',
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
      google_places_api_key: config.googlePlacesApiKey,
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
export async function uploadCompanyLogo(file: File): Promise<{ publicUrl: string; storagePath: string }> {
  try {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please upload PNG, JPG, SVG, or WebP');
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size must be less than 2MB');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `logo-${Date.now()}.${fileExt}`;
    const filePath = `company-logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('pdfs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('pdfs')
      .getPublicUrl(filePath);

    return { publicUrl, storagePath: filePath };
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    throw error;
  }
}

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
        logoStoragePath: branding.logo_storage_path || '',
        showCompanyName: branding.show_company_name || false,
        clientLoginLogoUrl: branding.client_login_logo_url || '',
        clientLoginLogoSize: branding.client_login_logo_size || 80,
        clientLoginCompanyName: branding.client_login_company_name || '',
        loginLogoSize: branding.login_logo_size || 80
      };
    }

    return {
      id: '',
      companyName: '',
      logoUrl: '',
      logoStoragePath: '',
      showCompanyName: false,
      clientLoginLogoUrl: '',
      clientLoginLogoSize: 80,
      clientLoginCompanyName: '',
      loginLogoSize: 80
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
      logo_storage_path: branding.logoStoragePath || null,
      show_company_name: branding.showCompanyName,
      client_login_logo_url: branding.clientLoginLogoUrl || null,
      client_login_logo_size: branding.clientLoginLogoSize || 80,
      client_login_company_name: branding.clientLoginCompanyName || null,
      login_logo_size: branding.loginLogoSize || 80,
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

// Secondary API Configuration
export async function fetchSecondaryApiConfigs(): Promise<SecondaryApiConfig[]> {
  try {
    const { data, error } = await supabase
      .from('secondary_api_configs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      return data.map(config => ({
        id: config.id,
        name: config.name,
        baseUrl: config.base_url,
        authToken: config.auth_token || '',
        description: config.description || '',
        isActive: config.is_active,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching secondary API configs:', error);
    throw error;
  }
}

export async function createSecondaryApiConfig(config: Omit<SecondaryApiConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<SecondaryApiConfig> {
  try {
    const configData = {
      name: config.name,
      base_url: config.baseUrl,
      auth_token: config.authToken || '',
      description: config.description || '',
      is_active: config.isActive,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('secondary_api_configs')
      .insert([configData])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      baseUrl: data.base_url,
      authToken: data.auth_token || '',
      description: data.description || '',
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error creating secondary API config:', error);
    throw error;
  }
}

export async function updateSecondaryApiConfig(id: string, config: Partial<SecondaryApiConfig>): Promise<void> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (config.name !== undefined) updateData.name = config.name;
    if (config.baseUrl !== undefined) updateData.base_url = config.baseUrl;
    if (config.authToken !== undefined) updateData.auth_token = config.authToken;
    if (config.description !== undefined) updateData.description = config.description;
    if (config.isActive !== undefined) updateData.is_active = config.isActive;

    const { error } = await supabase
      .from('secondary_api_configs')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating secondary API config:', error);
    throw error;
  }
}

export async function deleteSecondaryApiConfig(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('secondary_api_configs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting secondary API config:', error);
    throw error;
  }
}

export async function toggleSecondaryApiConfig(id: string, isActive: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('secondary_api_configs')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error toggling secondary API config:', error);
    throw error;
  }
}

// API Authentication Configuration
export interface ApiAuthConfigDB {
  id: string;
  name: string;
  loginEndpoint: string;
  pingEndpoint: string;
  tokenFieldName: string;
  username: string;
  password: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchApiAuthConfig(): Promise<ApiAuthConfigDB | null> {
  try {
    const { data, error } = await supabase
      .from('api_auth_config')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return {
        id: data.id,
        name: data.name,
        loginEndpoint: data.login_endpoint,
        pingEndpoint: data.ping_endpoint,
        tokenFieldName: data.token_field_name || 'access_token',
        username: data.username,
        password: data.password,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching API auth config:', error);
    throw error;
  }
}

export async function fetchAllApiAuthConfigs(): Promise<ApiAuthConfigDB[]> {
  try {
    const { data, error } = await supabase
      .from('api_auth_config')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      loginEndpoint: item.login_endpoint,
      pingEndpoint: item.ping_endpoint,
      tokenFieldName: item.token_field_name || 'access_token',
      username: item.username,
      password: item.password,
      isActive: item.is_active,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
  } catch (error) {
    console.error('Error fetching all API auth configs:', error);
    throw error;
  }
}

export async function fetchApiAuthConfigById(id: string): Promise<ApiAuthConfigDB | null> {
  try {
    const { data, error } = await supabase
      .from('api_auth_config')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return {
        id: data.id,
        name: data.name,
        loginEndpoint: data.login_endpoint,
        pingEndpoint: data.ping_endpoint,
        tokenFieldName: data.token_field_name || 'access_token',
        username: data.username,
        password: data.password,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching API auth config by ID:', error);
    throw error;
  }
}

export async function fetchApiAuthConfigByName(name: string): Promise<ApiAuthConfigDB | null> {
  try {
    const { data, error } = await supabase
      .from('api_auth_config')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return {
        id: data.id,
        name: data.name,
        loginEndpoint: data.login_endpoint,
        pingEndpoint: data.ping_endpoint,
        tokenFieldName: data.token_field_name || 'access_token',
        username: data.username,
        password: data.password,
        isActive: data.is_active,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching API auth config by name:', error);
    throw error;
  }
}

export async function saveApiAuthConfig(config: Omit<ApiAuthConfigDB, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiAuthConfigDB> {
  try {
    const { data: existingData } = await supabase
      .from('api_auth_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    const configData = {
      name: config.name,
      login_endpoint: config.loginEndpoint,
      ping_endpoint: config.pingEndpoint,
      token_field_name: config.tokenFieldName || 'access_token',
      username: config.username,
      password: config.password,
      is_active: config.isActive,
      updated_at: new Date().toISOString()
    };

    let result;

    if (existingData) {
      const { data, error } = await supabase
        .from('api_auth_config')
        .update(configData)
        .eq('id', existingData.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('api_auth_config')
        .insert([{ ...configData, created_at: new Date().toISOString() }])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return {
      id: result.id,
      name: result.name,
      loginEndpoint: result.login_endpoint,
      pingEndpoint: result.ping_endpoint,
      tokenFieldName: result.token_field_name || 'access_token',
      username: result.username,
      password: result.password,
      isActive: result.is_active,
      createdAt: result.created_at,
      updatedAt: result.updated_at
    };
  } catch (error) {
    console.error('Error saving API auth config:', error);
    throw error;
  }
}

export async function createApiAuthConfig(config: Omit<ApiAuthConfigDB, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiAuthConfigDB> {
  try {
    const configData = {
      name: config.name,
      login_endpoint: config.loginEndpoint,
      ping_endpoint: config.pingEndpoint,
      token_field_name: config.tokenFieldName || 'access_token',
      username: config.username,
      password: config.password,
      is_active: config.isActive,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('api_auth_config')
      .insert([configData])
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      loginEndpoint: data.login_endpoint,
      pingEndpoint: data.ping_endpoint,
      tokenFieldName: data.token_field_name || 'access_token',
      username: data.username,
      password: data.password,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error creating API auth config:', error);
    throw error;
  }
}

export async function updateApiAuthConfig(id: string, config: Omit<ApiAuthConfigDB, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiAuthConfigDB> {
  try {
    const configData = {
      name: config.name,
      login_endpoint: config.loginEndpoint,
      ping_endpoint: config.pingEndpoint,
      token_field_name: config.tokenFieldName || 'access_token',
      username: config.username,
      password: config.password,
      is_active: config.isActive,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('api_auth_config')
      .update(configData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      loginEndpoint: data.login_endpoint,
      pingEndpoint: data.ping_endpoint,
      tokenFieldName: data.token_field_name || 'access_token',
      username: data.username,
      password: data.password,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error updating API auth config:', error);
    throw error;
  }
}

export async function deleteApiAuthConfig(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('api_auth_config')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting API auth config:', error);
    throw error;
  }
}

export async function testApiAuthConnection(
  loginEndpoint: string,
  pingEndpoint: string,
  username: string,
  password: string,
  tokenFieldName: string = 'access_token'
): Promise<{ success: boolean; message: string; token?: string }> {
  try {
    const loginResponse = await fetch(loginEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text().catch(() => '');
      return {
        success: false,
        message: `Login failed: ${loginResponse.status} ${loginResponse.statusText}${errorText ? ` - ${errorText}` : ''}`
      };
    }

    const loginData = await loginResponse.json();
    const token = loginData[tokenFieldName];

    if (!token) {
      return {
        success: false,
        message: `Login response missing '${tokenFieldName}' field`
      };
    }

    if (pingEndpoint) {
      const pingResponse = await fetch(pingEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (pingResponse.status !== 204 && !pingResponse.ok) {
        return {
          success: false,
          message: `Ping failed: ${pingResponse.status} ${pingResponse.statusText}`,
          token
        };
      }
    }

    return {
      success: true,
      message: pingEndpoint ? 'Login and Ping successful' : 'Login successful',
      token
    };
  } catch (error) {
    return {
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}