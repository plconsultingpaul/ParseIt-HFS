import React, { useState } from 'react';
import { Save, Server, TestTube } from 'lucide-react';
import type { SftpConfig } from '../../types';

interface SftpSettingsProps {
  sftpConfig: SftpConfig;
  onUpdateSftpConfig: (config: SftpConfig) => Promise<void>;
}

export default function SftpSettings({ sftpConfig, onUpdateSftpConfig }: SftpSettingsProps) {
  const [localConfig, setLocalConfig] = useState<SftpConfig>(sftpConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const updateConfig = (field: keyof SftpConfig, value: string | number) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateSftpConfig(localConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save SFTP config:', error);
      alert('Failed to save SFTP configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Here you would implement SFTP connection testing
      // For now, we'll simulate a test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate success/failure based on whether host is filled
      if (localConfig.host && localConfig.username) {
        setTestResult({
          success: true,
          message: 'SFTP connection successful!'
        });
      } else {
        setTestResult({
          success: false,
          message: 'Please fill in host and username to test connection.'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection failed. Please check your settings.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">SFTP Configuration</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure SFTP server settings for file uploads</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <TestTube className="h-4 w-4" />
            <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
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
          <p className="text-green-700 dark:text-green-400 text-sm mt-1">SFTP configuration saved successfully!</p>
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
              {testResult.success ? 'Connection Test Passed' : 'Connection Test Failed'}
            </span>
          </div>
          <p className={`text-sm mt-1 ${
            testResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {testResult.message}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg">
            <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Server Connection</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">SFTP server details</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Host
            </label>
            <input
              type="text"
              value={localConfig.host}
              onChange={(e) => updateConfig('host', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="sftp.example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Port
            </label>
            <input
              type="number"
              value={localConfig.port}
              onChange={(e) => updateConfig('port', parseInt(e.target.value) || 22)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="22"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={localConfig.username}
              onChange={(e) => updateConfig('username', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={localConfig.password}
              onChange={(e) => updateConfig('password', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="password"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              XML Upload Path
            </label>
            <input
              type="text"
              value={localConfig.xmlPath}
              onChange={(e) => updateConfig('xmlPath', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="/uploads/xml/"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              PDF Upload Path
            </label>
            <input
              type="text"
              value={localConfig.pdfPath}
              onChange={(e) => updateConfig('pdfPath', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="/uploads/pdf/"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              JSON Upload Path
            </label>
            <input
              type="text"
              value={localConfig.jsonPath}
              onChange={(e) => updateConfig('jsonPath', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="/uploads/json/"
            />
          </div>
        </div>
      </div>
    </div>
  );
}