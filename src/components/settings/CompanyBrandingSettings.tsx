import React, { useState } from 'react';
import { Save, Building, Image, Eye, EyeOff } from 'lucide-react';
import type { CompanyBranding } from '../../types';

interface CompanyBrandingSettingsProps {
  companyBranding: CompanyBranding;
  onUpdateCompanyBranding: (branding: CompanyBranding) => Promise<void>;
}

export default function CompanyBrandingSettings({ 
  companyBranding, 
  onUpdateCompanyBranding 
}: CompanyBrandingSettingsProps) {
  const [localBranding, setLocalBranding] = useState<CompanyBranding>(companyBranding);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const updateBranding = (field: keyof CompanyBranding, value: string | boolean) => {
    setLocalBranding(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onUpdateCompanyBranding(localBranding);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save company branding:', error);
      alert('Failed to save company branding. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Company Branding</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Customize the application with your company's branding</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="font-semibold text-green-800 dark:text-green-300">Success!</span>
          </div>
          <p className="text-green-700 dark:text-green-400 text-sm mt-1">Company branding saved successfully!</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Company Information */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg">
              <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Company Information</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Basic company details for branding</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={localBranding.companyName}
                onChange={(e) => updateBranding('companyName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your Company Name"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This will appear alongside ParseIt in the application header
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Options
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="showCompanyName"
                  checked={localBranding.showCompanyName}
                  onChange={(e) => updateBranding('showCompanyName', e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded focus:ring-blue-500"
                />
                <label htmlFor="showCompanyName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show company name in header
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Logo Configuration */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg">
              <Image className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Company Logo</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add your company logo to the application</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Logo URL
              </label>
              <input
                type="url"
                value={localBranding.logoUrl || ''}
                onChange={(e) => updateBranding('logoUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter a URL to your company logo (PNG, JPG, or SVG recommended)
              </p>
            </div>

            {/* Logo Preview */}
            {localBranding.logoUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Logo Preview
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center space-x-4">
                    <img
                      src={localBranding.logoUrl}
                      alt="Company Logo Preview"
                      className="h-12 w-auto max-w-32 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const errorDiv = target.nextElementSibling as HTMLElement;
                        if (errorDiv) errorDiv.style.display = 'block';
                      }}
                    />
                    <div className="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-2">
                      <p className="text-red-700 dark:text-red-400 text-sm">Failed to load logo image</p>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p>Logo will appear in the sidebar and login screen</p>
                      <p className="text-xs mt-1">Recommended size: 200x50px or similar aspect ratio</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Branding Preview */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg">
              <Eye className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Branding Preview</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">How your branding will appear in the application</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Header Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Application Header
              </label>
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  {localBranding.logoUrl && (
                    <img
                      src={localBranding.logoUrl}
                      alt="Company Logo"
                      className="h-8 w-auto max-w-24 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 rounded-lg">
                    <div className="h-6 w-6 bg-white rounded flex items-center justify-center">
                      <span className="text-purple-600 font-bold text-sm">P</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                        ParseIt
                      </h1>
                      {localBranding.showCompanyName && localBranding.companyName && (
                        <>
                          <span className="text-gray-400 dark:text-gray-500">•</span>
                          <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                            {localBranding.companyName}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      PDF Data Extraction
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Login Screen Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Login Screen
              </label>
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-auto shadow-lg">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      {localBranding.logoUrl && (
                        <img
                          src={localBranding.logoUrl}
                          alt="Company Logo"
                          className="h-10 w-auto max-w-32 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 rounded-full">
                        <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center">
                          <span className="text-purple-600 font-bold">P</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center space-x-2 mb-2">
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ParseIt</h1>
                      {localBranding.showCompanyName && localBranding.companyName && (
                        <>
                          <span className="text-gray-400 dark:text-gray-500">•</span>
                          <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">
                            {localBranding.companyName}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-purple-600 dark:text-purple-400 text-sm">PDF Data Extraction Application</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Branding Guidelines</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>• Company logo should be in PNG, JPG, or SVG format for best quality</li>
          <li>• Recommended logo dimensions: 200x50px or similar aspect ratio</li>
          <li>• Logo will appear in the sidebar header and login screen</li>
          <li>• ParseIt branding will always remain visible alongside your company branding</li>
          <li>• Company name appears next to ParseIt when enabled</li>
          <li>• Use publicly accessible URLs for logo images (CDN recommended)</li>
        </ul>
      </div>
    </div>
  );
}