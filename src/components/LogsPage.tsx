import React, { useState } from 'react';
import { FileText, Clock, GitBranch, Server, Mail, Truck } from 'lucide-react';
import type { ExtractionLog, ExtractionType, TransformationType, User, EmailPollingLog, WorkflowExecutionLog, ExtractionWorkflow, WorkflowStep, SftpPollingLog, ProcessedEmail } from '../types';
import ExtractionLogsSettings from './settings/ExtractionLogsSettings';
import EmailPollingLogsSettings from './settings/EmailPollingLogsSettings';
import WorkflowExecutionLogsSettings from './settings/WorkflowExecutionLogsSettings';
import ProcessedEmailsSettings from './settings/ProcessedEmailsSettings';
import DriverCheckinLogsSettings from './settings/DriverCheckinLogsSettings';

interface LogsPageProps {
  extractionLogs: ExtractionLog[];
  extractionTypes: ExtractionType[];
  transformationTypes: TransformationType[];
  users: User[];
  emailPollingLogs: EmailPollingLog[];
  workflowExecutionLogs: WorkflowExecutionLog[];
  workflows: ExtractionWorkflow[];
  workflowSteps: WorkflowStep[];
  sftpPollingLogs: SftpPollingLog[];
  processedEmails: ProcessedEmail[];
  onRefreshLogs: () => Promise<void>;
  onRefreshLogsWithFilters: (filters: any) => Promise<any>;
  onRefreshPollingLogs: () => Promise<any>;
  onRefreshWorkflowLogs: () => Promise<any>;
  onRefreshSftpPollingLogs: () => Promise<any>;
  onRefreshProcessedEmails: () => Promise<any>;
}

type LogsTab = 'extraction' | 'polling' | 'workflow' | 'sftp' | 'processed' | 'checkin';

export default function LogsPage({
  extractionLogs,
  extractionTypes,
  transformationTypes,
  users,
  emailPollingLogs,
  workflowExecutionLogs,
  workflows,
  workflowSteps,
  sftpPollingLogs,
  processedEmails,
  onRefreshLogs,
  onRefreshLogsWithFilters,
  onRefreshPollingLogs,
  onRefreshWorkflowLogs,
  onRefreshSftpPollingLogs,
  onRefreshProcessedEmails
}: LogsPageProps) {
  const [activeTab, setActiveTab] = useState<LogsTab>('extraction');

  const tabs = [
    { id: 'extraction' as LogsTab, label: 'Processing Logs', icon: FileText, description: 'PDF extraction and transformation activity logs' },
    { id: 'workflow' as LogsTab, label: 'Workflow Logs', icon: GitBranch, description: 'Workflow execution logs' },
    { id: 'polling' as LogsTab, label: 'Email Polling', icon: Clock, description: 'Email monitoring activity' },
    { id: 'processed' as LogsTab, label: 'Processed Emails', icon: Mail, description: 'Processed email history' },
    { id: 'sftp' as LogsTab, label: 'SFTP Polling', icon: Server, description: 'SFTP folder monitoring logs' },
    { id: 'checkin' as LogsTab, label: 'Check-In Logs', icon: Truck, description: 'Driver check-in activity logs' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'extraction':
        return (
          <ExtractionLogsSettings
            extractionLogs={extractionLogs}
            extractionTypes={extractionTypes}
            users={users}
            onRefresh={onRefreshLogs}
            onRefreshWithFilters={onRefreshLogsWithFilters}
          />
        );
      case 'polling':
        return (
          <EmailPollingLogsSettings
            emailPollingLogs={emailPollingLogs}
            onRefreshPollingLogs={onRefreshPollingLogs}
          />
        );
      case 'workflow':
        return (
          <WorkflowExecutionLogsSettings
            workflowExecutionLogs={workflowExecutionLogs}
            workflows={workflows}
            workflowSteps={workflowSteps}
            onRefreshWorkflowLogs={onRefreshWorkflowLogs}
          />
        );
      case 'processed':
        return (
          <ProcessedEmailsSettings
            processedEmails={processedEmails}
            onRefresh={onRefreshProcessedEmails}
          />
        );
      case 'sftp':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">SFTP Polling Logs</h3>
              <p className="text-gray-600 mt-1">Monitor SFTP folder polling activity</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">SFTP Polling Information</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                <li>• SFTP polling logs show automated folder monitoring activity</li>
                <li>• Configure SFTP polling in Settings → SFTP Polling</li>
                <li>• Logs include files found, processed, and any errors encountered</li>
                <li>• Use Supabase cron jobs to schedule automatic polling</li>
              </ul>
            </div>
          </div>
        );
      case 'checkin':
        return <DriverCheckinLogsSettings />;
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