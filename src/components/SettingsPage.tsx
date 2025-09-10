import React, { useState } from 'react';
import { FileText, Server, Key, Mail, Filter, Database, Settings as SettingsIcon, Users, GitBranch, Clock } from 'lucide-react';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, EmailMonitoringConfig, EmailProcessingRule, ProcessedEmail, ExtractionLog, User, SecuritySettings } from '../types';

// Import the new settings components
import ExtractionTypesSettings from './settings/ExtractionTypesSettings';
import SftpSettings from './settings/SftpSettings';
import ApiSettings from './settings/ApiSettings';
import EmailMonitoringSettings from './settings/EmailMonitoringSettings';
import EmailRulesSettings from './settings/EmailRulesSettings';
import ProcessedEmailsSettings from './settings/ProcessedEmailsSettings';
import UserManagementSettings from './settings/UserManagementSettings';
import ExtractionLogsSettings from './settings/ExtractionLogsSettings';
import WorkflowSettings from './settings/WorkflowSettings';
import SecuritySettings from './settings/SecuritySettings';
import EmailPollingLogsSettings from './settings/EmailPollingLogsSettings';
import WorkflowExecutionLogsSettings from './settings/WorkflowExecutionLogsSettings';

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
  emailPollingLogs: any[];
  workflowExecutionLogs: any[];
  workflows: any[];
  workflowSteps: any[];
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
  onRefreshPollingLogs: () => Promise<any>;
  onRefreshWorkflowLogs: () => Promise<any>;
  onRefreshProcessedEmails: () => Promise<any>;
  workflows: any[];
  workflowSteps: any[];
}

type SettingsTab = 'extraction' | 'sftp' | 'api' | 'email' | 'rules' | 'processed' | 'logs' | 'polling' | 'users' | 'workflows' | 'workflow-logs';

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
  emailPollingLogs,
  workflowExecutionLogs,
  workflows,
  workflowSteps,
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
  onRefreshLogsWithFilters,
  onRefreshPollingLogs,
  onRefreshWorkflowLogs,
  onRefreshProcessedEmails,
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
    ...(currentUser.permissions.extractionTypes ? [{ id: 'extraction' as SettingsTab, label: 'Extraction Types', icon: FileText, description: 'Manage PDF extraction templates' }] : []),
    ...(currentUser.permissions.sftp ? [{ id: 'sftp' as SettingsTab, label: 'SFTP Settings', icon: Server, description: 'Configure file upload server' }] : []),
    ...(currentUser.permissions.api ? [{ id: 'api' as SettingsTab, label: 'API Settings', icon: Key, description: 'Configure API endpoints and keys' }] : []),
    ...(currentUser.permissions.emailMonitoring ? [{ id: 'email' as SettingsTab, label: 'Email Monitoring', icon: Mail, description: 'Configure email automation' }] : []),
    ...(currentUser.permissions.emailRules ? [{ id: 'rules' as SettingsTab, label: 'Email Rules', icon: Filter, description: 'Manage email processing rules' }] : []),
    ...(currentUser.permissions.processedEmails ? [{ id: 'processed' as SettingsTab, label: 'Processed Emails', icon: Database, description: 'View processed email history' }] : []),
    ...(currentUser.permissions.extractionLogs ? [{ id: 'logs' as SettingsTab, label: 'Extraction Logs', icon: FileText, description: 'View extraction activity logs' }] : []),
    ...(currentUser.permissions.emailMonitoring ? [{ id: 'polling' as SettingsTab, label: 'Polling Logs', icon: Clock, description: 'View email polling activity' }] : []),
    ...(currentUser.permissions.userManagement ? [{ id: 'users' as SettingsTab, label: 'User Management', icon: Users, description: 'Manage users and permissions' }] : []),
    ...(currentUser.permissions.workflowManagement ? [{ id: 'workflows' as SettingsTab, label: 'Workflows', icon: GitBranch, description: 'Create multi-step processes' }] : []),
    ...(currentUser.permissions.workflowManagement ? [{ id: 'workflow-logs' as SettingsTab, label: 'Workflow Logs', icon: GitBranch, description: 'View workflow execution logs' }] : [])
  ];

  const renderTabContent = (workflows: any[], workflowSteps: any[]) => {
    switch (activeTab) {
      case 'extraction':
        return currentUser.permissions.extractionTypes ? (
          <ExtractionTypesSettings
            extractionTypes={extractionTypes}
            onUpdateExtractionTypes={onUpdateExtractionTypes}
            onDeleteExtractionType={onDeleteExtractionType}
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
            onRefresh={onRefreshProcessedEmails}
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
      case 'polling':
        return currentUser.permissions.emailMonitoring ? (
          <EmailPollingLogsSettings
            emailPollingLogs={emailPollingLogs}
            onRefreshPollingLogs={onRefreshPollingLogs}
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
      case 'workflows':
        return currentUser.permissions.workflowManagement ? (
          <WorkflowSettings 
            apiConfig={apiConfig} 
            workflows={workflows}
            workflowSteps={workflowSteps}
          />
        ) : <PermissionDenied />;
      case 'workflow-logs':
        return currentUser.permissions.workflowManagement ? (
          <WorkflowExecutionLogsSettings
            workflowExecutionLogs={workflowExecutionLogs}
            workflows={workflows}
            workflowSteps={workflowSteps}
            onRefreshWorkflowLogs={onRefreshWorkflowLogs}
          />
        ) : <PermissionDenied />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] bg-white/90 backdrop-blur-sm rounded-xl shadow-xl border border-purple-100 overflow-hidden max-w-none">
      {/* Sidebar Navigation */}
      <div className="w-72 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-lg font-bold text-white mb-1">Settings</h2>
          <p className="text-purple-100 text-xs">Configure ParseIt</p>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    activeTab === tab.id
                      ? 'bg-purple-100 text-purple-700 shadow-sm border-l-3 border-purple-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-md transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'bg-purple-200'
                        : 'bg-gray-200 group-hover:bg-gray-300'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        activeTab === tab.id ? 'text-purple-600' : 'text-gray-500'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm ${
                        activeTab === tab.id ? 'text-purple-900' : 'text-gray-900'
                      }`}>
                        {tab.label}
                      </div>
                      <div className={`text-xs ${
                        activeTab === tab.id ? 'text-purple-600' : 'text-gray-500'
                      }`}>
                        {tab.description}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-100">
          <div className="text-xs text-gray-500 text-center">
            {tabs.length} setting{tabs.length !== 1 ? 's' : ''} available
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            {(() => {
              const currentTab = tabs.find(tab => tab.id === activeTab);
              if (!currentTab) return null;
              const Icon = currentTab.icon;
              return (
                <>
                  <div className="bg-purple-100 p-2 rounded-md">
                    <Icon className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{currentTab.label}</h3>
                    <p className="text-gray-600 mt-1">{currentTab.description}</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderTabContent(workflows, workflowSteps)}
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