import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiApiKey {
  id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeminiModel {
  id: string;
  api_key_id: string;
  model_name: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActiveGeminiConfig {
  apiKey: string;
  modelName: string;
}

export interface AvailableGeminiModel {
  name: string;
  displayName: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export const geminiConfigService = {
  async getActiveConfiguration(): Promise<ActiveGeminiConfig | null> {
    try {
      const { data: activeKey, error: keyError } = await supabase
        .from('gemini_api_keys')
        .select('api_key')
        .eq('is_active', true)
        .maybeSingle();

      if (keyError) throw keyError;
      if (!activeKey) return null;

      const { data: activeModel, error: modelError } = await supabase
        .from('gemini_models')
        .select('model_name')
        .eq('is_active', true)
        .maybeSingle();

      if (modelError) throw modelError;
      if (!activeModel) return null;

      return {
        apiKey: activeKey.api_key,
        modelName: activeModel.model_name
      };
    } catch (error) {
      console.error('Error fetching active Gemini configuration:', error);
      return null;
    }
  },

  async getAllApiKeys(): Promise<GeminiApiKey[]> {
    const { data, error } = await supabase
      .from('gemini_api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getModelsByApiKeyId(apiKeyId: string): Promise<GeminiModel[]> {
    const { data, error } = await supabase
      .from('gemini_models')
      .select('*')
      .eq('api_key_id', apiKeyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addApiKey(name: string, apiKey: string, setAsActive: boolean = false): Promise<GeminiApiKey> {
    const { data, error } = await supabase
      .from('gemini_api_keys')
      .insert({ name, api_key: apiKey, is_active: setAsActive })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateApiKey(id: string, updates: { name?: string; api_key?: string }): Promise<void> {
    const { error } = await supabase
      .from('gemini_api_keys')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteApiKey(id: string): Promise<void> {
    const { error } = await supabase
      .from('gemini_api_keys')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async setActiveApiKey(id: string): Promise<void> {
    const { error } = await supabase
      .from('gemini_api_keys')
      .update({ is_active: true })
      .eq('id', id);

    if (error) throw error;
  },

  async addModel(apiKeyId: string, modelName: string, displayName: string, setAsActive: boolean = false): Promise<GeminiModel> {
    const { data, error } = await supabase
      .from('gemini_models')
      .insert({
        api_key_id: apiKeyId,
        model_name: modelName,
        display_name: displayName,
        is_active: setAsActive
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addModels(apiKeyId: string, models: Array<{ modelName: string; displayName: string }>): Promise<void> {
    const modelsToInsert = models.map(m => ({
      api_key_id: apiKeyId,
      model_name: m.modelName,
      display_name: m.displayName,
      is_active: false
    }));

    const { error } = await supabase
      .from('gemini_models')
      .insert(modelsToInsert);

    if (error) throw error;
  },

  async deleteModel(id: string): Promise<void> {
    const { error } = await supabase
      .from('gemini_models')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async setActiveModel(id: string): Promise<void> {
    const { error } = await supabase
      .from('gemini_models')
      .update({ is_active: true })
      .eq('id', id);

    if (error) throw error;
  },

  async testApiKey(apiKey: string, modelName?: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!apiKey || apiKey.trim() === '') {
        return {
          success: false,
          message: 'API key is required'
        };
      }

      const testModel = modelName || 'gemini-1.5-flash';
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: testModel });

      const result = await model.generateContent('Say "Connection successful" if you can read this.');
      const response = await result.response;
      const text = response.text();

      return {
        success: true,
        message: `API key is valid! Successfully tested with ${testModel}.`,
        data: {
          model: testModel,
          response: text.substring(0, 100)
        }
      };
    } catch (error: any) {
      let errorMessage = 'Failed to connect to Google Gemini API';

      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key not valid')) {
        errorMessage = 'Invalid API key. Please check your Google Gemini API key.';
      } else if (error.message?.includes('API key expired')) {
        errorMessage = 'API key has expired. Please regenerate your key in Google AI Studio.';
      } else if (error.message?.includes('quota')) {
        errorMessage = 'API quota exceeded. Please check your Google Cloud Console.';
      } else if (error.message?.includes('not found')) {
        errorMessage = `Model not found or not accessible with this API key. ${error.message}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage
      };
    }
  },

  async fetchAvailableModels(apiKey: string): Promise<AvailableGeminiModel[]> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.models || !Array.isArray(data.models)) {
        throw new Error('Invalid response from Gemini API');
      }

      return data.models
        .filter((model: any) => model.name?.startsWith('models/gemini'))
        .map((model: any) => ({
          name: model.name.replace('models/', ''),
          displayName: model.displayName || model.name.replace('models/', ''),
          description: model.description || '',
          supportedGenerationMethods: model.supportedGenerationMethods || []
        }));
    } catch (error: any) {
      console.error('Error fetching available Gemini models:', error);
      throw new Error(error.message || 'Failed to fetch available models');
    }
  },

  async getExistingModelNames(apiKeyId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('gemini_models')
      .select('model_name')
      .eq('api_key_id', apiKeyId);

    if (error) throw error;
    return (data || []).map(m => m.model_name);
  }
};
