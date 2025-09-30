import React, { useState } from 'react';
import { FileText, Server, Key, Mail, Filter, Database, Settings as SettingsIcon, Users, GitBranch, RefreshCw } from 'lucide-react';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, EmailMonitoringConfig, EmailProcessingRule, ProcessedEmail, User } from '../types';
import type { TransformationType } from '../types';
import type { CompanyBranding } from '../types';

// Import the new settings components
import SftpSettings from './settings/SftpSettings';
import ApiSettings from './settings/ApiSettings';
import EmailMonitoringSettings from './settings/EmailMonitoringSettings';
import EmailRulesSettings from './settings/EmailRulesSettings';
import ProcessedEmailsSettings from './settings/ProcessedEmailsSettings';
import UserManagementSettings from './settings/UserManagementSettings';
import SftpPollingSettings from './settings/SftpPollingSettings';
import VendorManagementSettings from './settings/VendorManagementSettings';
import { Building } from 'lucide-react';
import CompanyBrandingSettings from './settings/CompanyBrandingSettings';

interface SettingsPageProps {
  extractionTypes: ExtractionType[];
  transformationTypes: TransformationType[];
  sftpConfig: SftpConfig;
  settingsConfig: SettingsConfig;
  apiConfig: ApiConfig;
  emailConfig: EmailMonitoringConfig;
  emailRules: EmailProcessingRule[];
  processedEmails: ProcessedEmail[];
  users: User[];
  currentUser: User;
  workflows: any[];
  workflowSteps: any[];
  companyBranding: CompanyBranding;
  getAllUsers: () => Promise<User[]>;
  createUser: (username: string, password: string, isAdmin: boolean) => Promise<{ success: boolean; message: string }>;
  updateUser: (userId: string, updates: { isAdmin?: boolean; isActive?: boolean }) => Promise<{ success: boolean; message: string }>;
  deleteUser: (userId: string) => Promise<{ success: boolean; message: string }>;
  onUpdateExtractionTypes: (types: ExtractionType[]) => Promise<void>;
  onDeleteExtractionType: (id: string) => Promise<void>;
  onUpdateTransformationTypes: (types: TransformationType[]) => Promise<void>;
  onDeleteTransformationType: (id: string) => Promise<void>;
  onUpdateTransformationTypes: (types: TransformationType[]) => Promise<void>;
  onDeleteTransformationType: (id: string) => Promise<void>;
  onUpdateSftpConfig: (config: SftpConfig) => Promise<void>;
  onUpdateSettingsConfig: (config: SettingsConfig) => Promise<void>;
  onUpdateApiConfig: (config: ApiConfig) => Promise<void>;
  onUpdateEmailConfig: (config: EmailMonitoringConfig) => Promise<void>;
  onUpdateEmailRules: (rules: EmailProcessingRule[]) => Promise<void>;
  onUpdateSftpPollingConfigs: (configs: any[]) => Promise<void>;
  onUpdateCompanyBranding: (branding: CompanyBranding) => Promise<void>;
}

type SettingsTab = 'sftp' | 'sftp-polling' | 'api' | 'email' | 'rules' | 'vendors' | 'users' | 'branding';

export default function SettingsPage({
  extractionTypes,
  transformationTypes,
  sftpConfig,
  settingsConfig,
  apiConfig,
  emailConfig,
  emailRules,
  processedEmails,
  users,
  currentUser,
  workflows,
  workflowSteps,
  companyBranding,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  onUpdateExtractionTypes,
  onDeleteExtractionType,
  onUpdateTransformationTypes,
  onDeleteTransformationType,
  onUpdateSftpConfig,
  onUpdateSettingsConfig,
  onUpdateApiConfig,
  onUpdateEmailConfig,
  onUpdateEmailRules,
  onUpdateSftpPollingConfigs,
  onUpdateCompanyBranding,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sftp');

  const tabs = [
    ...(currentUser.permissions.sftp ? [{ id: 'sftp' as SettingsTab, label: 'SFTP Settings', icon: Server, description: 'Configure file upload server' }] : []),
    ...(currentUser.permissions.sftp ? [{ id: 'sftp-polling' as SettingsTab, label: 'SFTP Polling', icon: Server, description: 'Monitor SFTP folders for PDFs' }] : []),
    ...(currentUser.permissions.api ? [{ id: 'api' as SettingsTab, label: 'API Settings', icon: Key, description: 'Configure API endpoints and keys' }] : []),
    ...(currentUser.permissions.emailMonitoring ? [{ id: 'email' as SettingsTab, label: 'Email Monitoring', icon: Mail, description: 'Configure email automation' }] : []),
    ...(currentUser.permissions.emailRules ? [{ id: 'rules' as SettingsTab, label: 'Email Rules', icon: Filter, description: 'Manage email processing rules' }] : []),
    ...(currentUser.isAdmin ? [{ id: 'vendors' as SettingsTab, label: 'Vendor Management', icon: Users, description: 'Manage vendor accounts and rules' }] : []),
    ...(currentUser.permissions.userManagement ? [{ id: 'users' as SettingsTab, label: 'User Management', icon: Users, description: 'Manage users and permissions' }] : []),
    ...(currentUser.isAdmin ? [{ id: 'branding' as SettingsTab, label: 'Company Branding', icon: Building, description: 'Customize company branding' }] : [])
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sftp':
        return currentUser.permissions.sftp ? (
          <SftpSettings
            sftpConfig={sftpConfig}
            onUpdateSftpConfig={onUpdateSftpConfig}
          />
        ) : <PermissionDenied />;
      case 'sftp-polling':
        return currentUser.permissions.sftp ? (
          <SftpPollingSettings
            extractionTypes={extractionTypes}
            transformationTypes={transformationTypes}
            workflows={workflows}
            onUpdateSftpPollingConfigs={async (configs) => {
              await onUpdateSftpPollingConfigs(configs);
            }}
            onRefreshSftpPollingLogs={async () => {
              console.log('Refreshing SFTP polling logs');
              return [];
            }}
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
            transformationTypes={transformationTypes}
            onUpdateEmailRules={onUpdateEmailRules}
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
        ) : <PermissionDenied />;
      case 'vendors':
        return currentUser.isAdmin ? (
          <VendorManagementSettings
            currentUser={currentUser}
            extractionTypes={extractionTypes}
            transformationTypes={transformationTypes}
            getAllUsers={getAllUsers}
            createUser={createUser}
            updateUser={updateUser}
            deleteUser={deleteUser}
          />
        ) : <PermissionDenied />;
      case 'branding':
        return currentUser.isAdmin ? (
          <CompanyBrandingSettings
            companyBranding={companyBranding}
            onUpdateCompanyBranding={onUpdateCompanyBranding}
          />
        ) : <PermissionDenied />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Horizontal Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-md transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-600 text-purple-700 dark:text-purple-300 shadow-sm font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <Icon className={`h-4 w-4 ${
                activeTab === tab.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'
              }`} />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-xl border border-purple-100 dark:border-gray-700 p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}

function PermissionDenied() {
  return (
    <div className="text-center py-12">
      <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <SettingsIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
      <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this settings section.</p>
      <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Contact your administrator to request access.</p>
    </div>
  );
}