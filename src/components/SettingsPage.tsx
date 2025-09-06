import React, { useState } from 'react';
import { FileText, Server, Key, Mail, Filter, Database, Settings as SettingsIcon, Users } from 'lucide-react';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, EmailMonitoringConfig, EmailProcessingRule, ProcessedEmail, ExtractionLog, User } from '../types';

// Import the new settings components
import ExtractionTypesSettings from './settings/ExtractionTypesSettings';
import SftpSettings from './settings/SftpSettings';
import ApiSettings from './settings/ApiSettings';
import EmailMonitoringSettings from './settings/EmailMonitoringSettings';
import EmailRulesSettings from './settings/EmailRulesSettings';
import ProcessedEmailsSettings from './settings/ProcessedEmailsSettings';
import UserManagementSettings from './settings/UserManagementSettings';
import ExtractionLogsSettings from './settings/ExtractionLogsSettings';

interface SettingsPageProps {
  extractionTypes: ExtractionType[];
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  emailConfig: EmailMonitoringConfig;
  emailRules: EmailProcessingRule[];
  processedEmails: ProcessedEmail[];
  extractionLogs: ExtractionLog[];
  users: User[];
  currentUser: User;
  getAllUsers: () => Promise<User[]>;
  createUser: (username: string, password: string, isAdmin: boolean) => Promise<{ success: boolean; message: string }>;
  updateUser: (userId: string, updates: { isAdmin?: boolean; isActive?: boolean }) => Promise<{ success: boolean; message: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
  onUpdateExtractionTypes: (types: ExtractionType[]) => Promise<void>;
  onUpdateSftpConfig: (config: SftpConfig) => Promise<void>;
  onUpdateSettingsConfig: (config: SettingsConfig) => Promise<void>;
  onUpdateApiConfig: (config: ApiConfig) => Promise<void>;
  onUpdateEmailConfig: (config: EmailMonitoringConfig) => Promise<void>;
  onUpdateEmailRules: (rules: EmailProcessingRule[]) => Promise<void>;
  onRefreshLogs: () => Promise<void>;
  onRefreshLogsWithFilters: (filters: any) => Promise<any>;
}

type SettingsTab = 'extraction' | 'sftp' | 'api' | 'email' | 'rules' | 'processed' | 'logs' | 'users';

export default function SettingsPage({
  extractionTypes,
  sftpConfig,
  settingsConfig,
  apiConfig,
  emailConfig,
  emailRules,
  processedEmails,
  extractionLogs,
  users,
  currentUser,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  onUpdateExtractionTypes,
  onUpdateSftpConfig,
  onUpdateSettingsConfig,
  onUpdateApiConfig,
  onUpdateEmailConfig,
  onUpdateEmailRules,
  onRefreshLogs,
  onRefreshLogsWithFilters
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('extraction');

  const handleRefreshLogs = async () => {
    try {
      await onRefreshLogs();
    } catch (error) {
      console.error('Failed to refresh logs:', error);
    }
  };

  const tabs = [
    ...(currentUser.permissions.extractionTypes ? [{ id: 'extraction' as SettingsTab, label: 'Extraction Types', icon: FileText }] : []),
    ...(currentUser.permissions.sftp ? [{ id: 'sftp' as SettingsTab, label: 'SFTP', icon: Server }] : []),
    ...(currentUser.permissions.api ? [{ id: 'api' as SettingsTab, label: 'API', icon: Key }] : []),
    ...(currentUser.permissions.emailMonitoring ? [{ id: 'email' as SettingsTab, label: 'Email Monitoring', icon: Mail }] : []),
    ...(currentUser.permissions.emailRules ? [{ id: 'rules' as SettingsTab, label: 'Email Rules', icon: Filter }] : []),
    ...(currentUser.permissions.processedEmails ? [{ id: 'processed' as SettingsTab, label: 'Processed Emails', icon: Database }] : []),
    ...(currentUser.permissions.extractionLogs ? [{ id: 'logs' as SettingsTab, label: 'Extraction Logs', icon: FileText }] : []),
    ...(currentUser.permissions.userManagement ? [{ id: 'users' as SettingsTab, label: 'Users', icon: Users }] : [])
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'extraction':
        return currentUser.permissions.extractionTypes ? (
          <ExtractionTypesSettings
            extractionTypes={extractionTypes}
            onUpdateExtractionTypes={onUpdateExtractionTypes}
          />
        ) : <PermissionDenied />;
      case 'sftp':
        return currentUser.permissions.sftp ? (
          <SftpSettings
            sftpConfig={sftpConfig}
            onUpdateSftpConfig={onUpdateSftpConfig}
          />
        ) : <PermissionDenied />;
      case 'api':
        return currentUser.permissions.api ? (
          <ApiSettings
            apiConfig={apiConfig}
            onUpdateApiConfig={onUpdateApiConfig}
          />
        ) : <PermissionDenied />;
      case 'email':
        return currentUser.permissions.emailMonitoring ? (
          <EmailMonitoringSettings
            emailConfig={emailConfig}
            onUpdateEmailConfig={onUpdateEmailConfig}
          />
        ) : <PermissionDenied />;
      case 'rules':
        return currentUser.permissions.emailRules ? (
          <EmailRulesSettings
            emailRules={emailRules}
            extractionTypes={extractionTypes}
            onUpdateEmailRules={onUpdateEmailRules}
          />
        ) : <PermissionDenied />;
      case 'processed':
        return currentUser.permissions.processedEmails ? (
          <ProcessedEmailsSettings
            processedEmails={processedEmails}
          />
        ) : <PermissionDenied />;
      case 'logs':
        return currentUser.permissions.extractionLogs ? (
          <ExtractionLogsSettings
            extractionLogs={extractionLogs}
            extractionTypes={extractionTypes}
            users={users}
            onRefresh={handleRefreshLogs}
            onRefreshWithFilters={onRefreshLogsWithFilters}
          />
        ) : <PermissionDenied />;
      case 'users':
        return currentUser.permissions.userManagement ? (
          <UserManagementSettings
            currentUser={currentUser}
            getAllUsers={getAllUsers}
            createUser={createUser}
            updateUser={updateUser}
            deleteUser={deleteUser}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Settings</h2>
        <p className="text-gray-600">Configure your ParseIt application settings</p>
      </div>

      {/* Tabs */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

function PermissionDenied() {
  return (
    <div className="text-center py-12">
      <div className="bg-red-100 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <SettingsIcon className="h-8 w-8 text-red-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
      <p className="text-gray-600">You don't have permission to access this settings section.</p>
      <p className="text-gray-500 text-sm mt-2">Contact your administrator to request access.</p>
    </div>
  );
}