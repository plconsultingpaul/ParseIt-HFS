import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, Loader2, Truck, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Workflow, DriverCheckinSettings as DriverCheckinSettingsType } from '../../types';
import Select from '../common/Select';

interface DriverCheckinSettingsProps {
  workflows: Workflow[];
}

export default function DriverCheckinSettings({ workflows }: DriverCheckinSettingsProps) {
  const [settings, setSettings] = useState<DriverCheckinSettingsType | null>(null);
  const [fallbackWorkflowId, setFallbackWorkflowId] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    generateQRCodeUrl();
  }, [baseUrl]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('driver_checkin_settings')
        .select('*')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const settingsData: DriverCheckinSettingsType = {
          id: data.id,
          fallbackWorkflowId: data.fallback_workflow_id,
          additionalFields: data.additional_fields || [],
          isEnabled: data.is_enabled,
          baseUrl: data.base_url,
          darkModeEnabled: data.dark_mode_enabled,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        };
        setSettings(settingsData);
        setFallbackWorkflowId(data.fallback_workflow_id || '');
        setIsEnabled(data.is_enabled || false);
        setBaseUrl(data.base_url || '');
        setDarkModeEnabled(data.dark_mode_enabled || false);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setMessage({ type: 'error', text: 'Failed to load driver check-in settings' });
    } finally {
      setLoading(false);
    }
  };

  const generateQRCodeUrl = () => {
    const effectiveBaseUrl = baseUrl || window.location.origin;
    const checkinUrl = `${effectiveBaseUrl}/driver-checkin`;
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(checkinUrl)}`);
  };

  const handleDownloadQRCode = async () => {
    setDownloading(true);
    setDownloadMessage(null);

    try {
      const response = await fetch(qrCodeUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch QR code image');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'driver-checkin-qr-code.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setDownloadMessage({ type: 'success', text: 'QR code downloaded successfully' });
      setTimeout(() => setDownloadMessage(null), 3000);
    } catch (err) {
      console.error('Error downloading QR code:', err);
      setDownloadMessage({ type: 'error', text: 'Failed to download QR code. Please try again.' });
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    if (!fallbackWorkflowId) {
      setMessage({ type: 'error', text: 'Please select a fallback workflow' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const updateData = {
        fallback_workflow_id: fallbackWorkflowId,
        is_enabled: isEnabled,
        base_url: baseUrl || null,
        dark_mode_enabled: darkModeEnabled,
        updated_at: new Date().toISOString()
      };

      if (settings?.id) {
        const { error } = await supabase
          .from('driver_checkin_settings')
          .update(updateData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('driver_checkin_settings')
          .insert([{
            ...updateData,
            additional_fields: []
          }]);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Driver check-in settings saved successfully' });
      await loadSettings();
    } catch (err) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: 'Failed to save driver check-in settings' });
    } finally {
      setSaving(false);
    }
  };

  const activeWorkflows = workflows.filter(w => w.isActive);
  const selectedWorkflow = workflows.find(w => w.id === fallbackWorkflowId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg">
          <Truck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Driver Check-In Settings</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure the driver check-in system for BOL document processing
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-start space-x-3 ${
          message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="isEnabled"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            className="h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="isEnabled" className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Enable Driver Check-In System
          </label>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="darkModeEnabled"
            checked={darkModeEnabled}
            onChange={(e) => setDarkModeEnabled(e.target.checked)}
            className="h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label htmlFor="darkModeEnabled" className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Enable Dark Mode for Driver Check-In Page
          </label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-8">
          When enabled, drivers will see the check-in page in dark mode when scanning the QR code
        </p>

        {isEnabled && !fallbackWorkflowId && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-400">
              <p className="font-semibold mb-1">Configuration Required</p>
              <p>Please select a fallback workflow before enabling the system. This workflow will be used when AI cannot detect the document type.</p>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Custom Base URL (Optional)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Enter your production URL (e.g., https://yourdomain.com). If left empty, the current URL will be used.
          </p>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://yourdomain.com"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fallback Workflow
            <span className="text-red-500 ml-1">*</span>
          </label>
          <Select
            value={fallbackWorkflowId || '__none__'}
            onValueChange={(value) => setFallbackWorkflowId(value === '__none__' ? '' : value)}
            options={[
              { value: '__none__', label: 'Select a workflow...' },
              ...activeWorkflows.map((workflow) => ({
                value: workflow.id,
                label: `${workflow.name}${workflow.description ? ` - ${workflow.description}` : ''}`
              }))
            ]}
            helpText="This workflow will be used when AI auto-detection fails to identify the BOL document type"
            required
          />
          {fallbackWorkflowId && selectedWorkflow && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                <span className="font-semibold">Selected Workflow:</span> {selectedWorkflow.name}
              </p>
              {selectedWorkflow.description && (
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{selectedWorkflow.description}</p>
              )}
              {selectedWorkflow.steps && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  {selectedWorkflow.steps.length} step(s) configured
                </p>
              )}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving || !fallbackWorkflowId}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isEnabled && fallbackWorkflowId && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">QR Code for Driver Access</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Scan this QR code with a mobile device to access the driver check-in page
          </p>

          {downloadMessage && (
            <div className={`mb-4 p-3 rounded-lg flex items-start space-x-2 ${
              downloadMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
            }`}>
              {downloadMessage.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${downloadMessage.type === 'success' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}`}>
                {downloadMessage.text}
              </p>
            </div>
          )}

          <div className="flex flex-col items-center space-y-4">
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600">
              <img
                src={qrCodeUrl}
                alt="Driver Check-In QR Code"
                className="w-64 h-64"
              />
            </div>
            <button
              onClick={handleDownloadQRCode}
              disabled={downloading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {downloading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>Download QR Code</span>
                </>
              )}
            </button>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Direct URL:</p>
              <a
                href={`${baseUrl || window.location.origin}/driver-checkin`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline break-all"
              >
                {baseUrl || window.location.origin}/driver-checkin
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">How Driver Check-In Works</h3>
        <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">1.</span>
            <span>Driver scans QR code or visits the check-in URL on their mobile device</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">2.</span>
            <span>Driver enters their phone number to identify themselves</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">3.</span>
            <span>System checks if driver exists; if new, driver enters name and company</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">4.</span>
            <span>Driver enters number of BOLs and door number</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">5.</span>
            <span>Driver scans/photographs each BOL document using their device camera</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">6.</span>
            <span>AI auto-detection identifies document type and selects appropriate workflow</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">7.</span>
            <span>If detection fails, the fallback workflow configured above is used</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="font-semibold text-blue-600 dark:text-blue-400">8.</span>
            <span>Documents are processed and stored for review in the check-in logs</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
