import React, { useState } from 'react';
import { Save, Mail, TestTube, Play, Pause, Cloud, Globe } from 'lucide-react';
import type { EmailMonitoringConfig } from '../../types';

interface EmailMonitoringSettingsProps {
  emailConfig: EmailMonitoringConfig;
  onUpdateEmailConfig: (config: EmailMonitoringConfig) => Promise<void>;
}

export default function EmailMonitoringSettings({ 
  emailConfig, 
  onUpdateEmailConfig 
}: EmailMonitoringSettingsProps) {
  const [localConfig, setLocalConfig] = useState<EmailMonitoringConfig>(emailConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; emailCount?: number } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [gmailTestResult, setGmailTestResult] = useState<{ success: boolean; message: string; emailCount?: number } | null>(null);
  const [isTestingGmail, setIsTestingGmail] = useState(false);

  const updateConfig = (field: keyof EmailMonitoringConfig, value: string | number | boolean) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateEmailConfig(localConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save email config:', error);
      alert('Failed to save email configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestOffice365 = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/test-office365`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          provider: 'office365',
          tenantId: localConfig.tenantId,
          clientId: localConfig.clientId,
          clientSecret: localConfig.clientSecret,
          monitoredEmail: localConfig.monitoredEmail
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setTestResult({
          success: true,
          message: result.message,
          emailCount: result.emailCount
        });
      } else {
        setTestResult({
          success: false,
          message: result.details || result.error || 'Connection test failed'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Office 365 connection test failed. Please check your settings.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestGmail = async () => {
    setIsTestingGmail(true);
    setGmailTestResult(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/test-email-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          provider: 'gmail',
          gmailClientId: localConfig.gmailClientId,
          gmailClientSecret: localConfig.gmailClientSecret,
          gmailRefreshToken: localConfig.gmailRefreshToken,
          gmailMonitoredLabel: localConfig.gmailMonitoredLabel
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setGmailTestResult({
          success: true,
          message: result.message,
          emailCount: result.emailCount
        });
      } else {
        setGmailTestResult({
          success: false,
          message: result.details || result.error || 'Gmail connection test failed'
        });
      }
    } catch (error) {
      setGmailTestResult({
        success: false,
        message: 'Gmail connection test failed. Please check your settings.'
      });
    } finally {
      setIsTestingGmail(false);
    }
  };

  const handleRunMonitoring = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/email-monitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`Email monitoring completed successfully!\n\nEmails checked: ${result.emailsChecked || 0}\nEmails processed: ${result.emailsProcessed || 0}\n\nCheck the "Polling Logs" tab to see detailed activity.`);
      } else {
        alert(`Email monitoring failed: ${result.details || result.error}`);
      }
    } catch (error) {
      alert('Failed to run email monitoring. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Email Monitoring</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Configure email monitoring for automatic PDF processing</p>
        </div>
        <div className="flex items-center space-x-3">
          {localConfig.provider === 'office365' && (
            <button
              onClick={handleTestOffice365}
              disabled={isTesting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <TestTube className="h-4 w-4" />
              <span>{isTesting ? 'Testing...' : 'Test Office 365'}</span>
            </button>
          )}
          {localConfig.provider === 'gmail' && (
            <button
              onClick={handleTestGmail}
              disabled={isTestingGmail}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <TestTube className="h-4 w-4" />
              <span>{isTestingGmail ? 'Testing...' : 'Test Gmail'}</span>
            </button>
          )}
          <button
            onClick={handleRunMonitoring}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>Run Now</span>
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
          <p className="text-green-700 dark:text-green-400 text-sm mt-1">Email monitoring configuration saved successfully!</p>
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
            {testResult.emailCount !== undefined && (
              <span className="block mt-1">Recent emails found: {testResult.emailCount}</span>
            )}
          </p>
        </div>
      )}

      {gmailTestResult && (
        <div className={`border rounded-lg p-4 ${
          gmailTestResult.success 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
        }`}>
          <div className="flex items-center space-x-2">
            <div className={`w-4 h-4 rounded-full ${
              gmailTestResult.success ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className={`font-semibold ${
              gmailTestResult.success ? 'text-green-800' : 'text-red-800'
            } dark:${gmailTestResult.success ? 'text-green-300' : 'text-red-300'}`}>
              {gmailTestResult.success ? 'Gmail Test Passed' : 'Gmail Test Failed'}
            </span>
          </div>
          <p className={`text-sm mt-1 ${
            gmailTestResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {gmailTestResult.message}
            {gmailTestResult.emailCount !== undefined && (
              <span className="block mt-1">Recent emails found: {gmailTestResult.emailCount}</span>
            )}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg">
              <Mail className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Email Provider Configuration</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure your email provider settings</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => updateConfig('isEnabled', !localConfig.isEnabled)}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                localConfig.isEnabled 
                  ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {localConfig.isEnabled ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <span className={`text-sm font-medium ${
              localConfig.isEnabled ? 'text-green-600' : 'text-gray-600'
            }`}>
              {localConfig.isEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* AI Auto-Detect Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-gray-900 dark:text-gray-100">AI Auto-Detection</h5>
              <p className="text-sm text-gray-500 dark:text-gray-400">Use AI to automatically detect extraction type before applying email rules</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => updateConfig('enableAutoDetect', !localConfig.enableAutoDetect)}
                className={`p-2 rounded-lg transition-colors duration-200 ${
                  localConfig.enableAutoDetect 
                    ? 'bg-purple-100 text-purple-600 hover:bg-purple-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {localConfig.enableAutoDetect ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <span className={`text-sm font-medium ${
                localConfig.enableAutoDetect ? 'text-purple-600' : 'text-gray-600'
              }`}>
                {localConfig.enableAutoDetect ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Provider Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Email Provider
            </label>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                type="button"
                onClick={() => updateConfig('provider', 'office365')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                  localConfig.provider === 'office365'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Cloud className="h-4 w-4" />
                <span>Office 365</span>
              </button>
              <button
                type="button"
                onClick={() => updateConfig('provider', 'gmail')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                  localConfig.provider === 'gmail'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>Gmail</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {localConfig.provider === 'office365' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tenant ID
                </label>
                <input
                  type="text"
                  value={localConfig.tenantId}
                  onChange={(e) => updateConfig('tenantId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={localConfig.clientId}
                  onChange={(e) => updateConfig('clientId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gmail Client ID
                </label>
                <input
                  type="text"
                  value={localConfig.gmailClientId || ''}
                  onChange={(e) => updateConfig('gmailClientId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="xxxxxxxxxx.apps.googleusercontent.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gmail Client Secret
                </label>
                <input
                  type="password"
                  value={localConfig.gmailClientSecret || ''}
                  onChange={(e) => updateConfig('gmailClientSecret', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Gmail OAuth client secret"
                />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {localConfig.provider === 'office365' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={localConfig.clientSecret}
                  onChange={(e) => updateConfig('clientSecret', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Client secret value"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monitored Email
                </label>
                <input
                  type="email"
                  value={localConfig.monitoredEmail}
                  onChange={(e) => updateConfig('monitoredEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="email@company.com"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Gmail Refresh Token
                </label>
                <input
                  type="password"
                  value={localConfig.gmailRefreshToken || ''}
                  onChange={(e) => updateConfig('gmailRefreshToken', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="OAuth refresh token"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monitored Label/Folder
                </label>
                <input
                  type="text"
                  value={localConfig.gmailMonitoredLabel || 'INBOX'}
                  onChange={(e) => updateConfig('gmailMonitoredLabel', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="INBOX or custom label name"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Gmail label to monitor (e.g., "INBOX", "ParseIt", "Invoices")
                </p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Polling Interval (minutes)
            </label>
            <input
              type="number"
              value={localConfig.pollingInterval}
              onChange={(e) => updateConfig('pollingInterval', parseInt(e.target.value) || 5)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              min="1"
              max="60"
            />
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {localConfig.lastCheck && (
                <p>Last check: {new Date(localConfig.lastCheck).toLocaleString()}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      {localConfig.provider === 'office365' ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Office 365 Setup Instructions</h4>
          <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
            <li>Register an application in Azure AD</li>
            <li>Grant Mail.Read permissions for the target mailbox</li>
            <li>Create a client secret</li>
            <li>Copy the Tenant ID, Client ID, and Client Secret here</li>
            <li>Test the connection before enabling monitoring</li>
          </ol>
        </div>
      ) : (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Gmail Setup Instructions</h4>
          <ol className="text-sm text-green-700 dark:text-green-400 space-y-1 list-decimal list-inside">
            <li>Create a project in <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-green-900">Google Cloud Console</a></li>
            <li>Enable the Gmail API for your project</li>
            <li>Configure OAuth consent screen with gmail.readonly scope</li>
            <li>Create OAuth 2.0 credentials (Desktop or Web application)</li>
            <li>Use <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="underline hover:text-green-900">OAuth 2.0 Playground</a> to get refresh token</li>
            <li>Enter your credentials here and test the connection</li>
          </ol>
          <div className="mt-3 p-3 bg-green-100 dark:bg-green-800/50 rounded-lg">
            <p className="text-xs text-green-800 dark:text-green-300">
              <strong>Required OAuth Scope:</strong> <code className="bg-green-200 dark:bg-green-700 px-1 rounded">https://www.googleapis.com/auth/gmail.readonly</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}