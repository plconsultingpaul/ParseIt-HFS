import React, { useState } from 'react';
import { Save, Key, Globe, TestTube } from 'lucide-react';
import type { ApiConfig } from '../../types';

interface ApiSettingsProps {
  apiConfig: ApiConfig;
  onUpdateApiConfig: (config: ApiConfig) => Promise<void>;
}

export default function ApiSettings({ apiConfig, onUpdateApiConfig }: ApiSettingsProps) {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(apiConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [isTesting, setIsTesting] = useState(false);


  const updateConfig = (field: keyof ApiConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      console.log('Saving API config:', localConfig);
      await onUpdateApiConfig(localConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save API config:', error);
      alert('Failed to save API configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };


  const handleTestTruckMateApi = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      if (!localConfig.path) {
        setTestResult({
          success: false,
          message: 'Please enter a Base API Path first'
        });
        return;
      }

      const testUrl = localConfig.path.endsWith('/') 
        ? `${localConfig.path.slice(0, -1)}/WHOAMI`
        : `${localConfig.path}/WHOAMI`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (localConfig.password) {
        headers['Authorization'] = `Bearer ${localConfig.password}`;
      }

      const response = await fetch(testUrl, {
        method: 'GET',
        headers
      });

      if (response.ok) {
        const responseData = await response.json();
        setTestResult({
          success: true,
          message: 'TruckMate API connection successful!',
          data: responseData
        });
      } else {
        const errorText = await response.text();
        setTestResult({
          success: false,
          message: `API call failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">API Configuration</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure API settings for JSON data transmission</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestTruckMateApi}
            disabled={isTesting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <TestTube className="h-4 w-4" />
            <span>{isTesting ? 'Testing...' : 'Test TruckMate API'}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="font-semibold text-green-800 dark:text-green-300">Success!</span>
          </div>
          <p className="text-green-700 dark:text-green-400 text-sm mt-1">API configuration saved successfully!</p>
        </div>
      )}

      {testResult && (
        <div className={`border rounded-lg p-4 ${
          testResult.success 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-4 h-4 rounded-full ${
              testResult.success ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className={`font-semibold ${
              testResult.success ? 'text-green-800' : 'text-red-800'
            } dark:${testResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {testResult.success ? 'API Test Passed' : 'API Test Failed'}
            </span>
          </div>
          <p className={`text-sm mt-1 ${
            testResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {testResult.message}
          </p>
          {testResult.data && (
            <div className="mt-3 bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">API Response:</p>
              <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}


      <div className="space-y-6">
        {/* API Endpoint Settings */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg">
              <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">API Endpoint</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Base URL for JSON data transmission</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Base API Path
              </label>
              <input
                type="text"
                value={localConfig.path}
                onChange={(e) => updateConfig('path', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="https://api.example.com/v1"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This will be combined with the JSON Path from extraction types
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Password/Token
              </label>
              <input
                type="password"
                value={localConfig.password}
                onChange={(e) => updateConfig('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Bearer token or API key"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Optional: Used as Authorization header
              </p>
            </div>
          </div>
        </div>

        {/* Google Gemini API Settings */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Google Gemini API</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">API key for PDF data extraction</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={localConfig.googleApiKey}
              onChange={(e) => updateConfig('googleApiKey', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your Google Gemini API key"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Get your API key from{' '}
              <a 
                href="https://makersuite.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>
        </div>


        {/* Usage Information */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">How API Integration Works</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
            <li>• JSON extraction types will send data to: <code className="bg-blue-100 px-1 rounded">Base API Path + JSON Path</code></li>
            <li>• Data is sent as POST request with JSON body</li>
            <li>• Authorization header is added if API password is provided</li>
            <li>• Google Gemini API is used for PDF data extraction</li>
            <li>• Use "Test TruckMate API" to verify your API connection with /WHOAMI endpoint</li>
          </ul>
        </div>
      </div>
    </div>
  );
}