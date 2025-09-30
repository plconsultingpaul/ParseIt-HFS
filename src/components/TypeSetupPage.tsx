import React, { useState } from 'react';
import { FileText, RefreshCw, GitBranch } from 'lucide-react';
import type { ExtractionType, TransformationType, ExtractionWorkflow, WorkflowStep, ApiConfig, User } from '../types';
import ExtractionTypesSettings from './settings/ExtractionTypesSettings';
import TransformationTypesSettings from './settings/TransformationTypesSettings';
import WorkflowSettings from './settings/WorkflowSettings';

interface TypeSetupPageProps {
  extractionTypes: ExtractionType[];
  transformationTypes: TransformationType[];
  workflows: ExtractionWorkflow[];
  workflowSteps: WorkflowStep[];
  apiConfig: ApiConfig;
  currentUser: User;
  refreshData: () => Promise<void>;
  refreshData: () => Promise<void>;
  onUpdateExtractionTypes: (types: ExtractionType[]) => Promise<void>;
  onDeleteExtractionType: (id: string) => Promise<void>;
  onUpdateTransformationTypes: (types: TransformationType[]) => Promise<void>;
  onDeleteTransformationType: (id: string) => Promise<void>;
}

type TypeSetupTab = 'extraction' | 'transformation' | 'workflows';

export default function TypeSetupPage({
  extractionTypes,
  transformationTypes,
  workflows,
  workflowSteps,
  apiConfig,
  currentUser,
  refreshData,
  onUpdateExtractionTypes,
  onDeleteExtractionType,
  onUpdateTransformationTypes,
  onDeleteTransformationType
}: TypeSetupPageProps) {
  const [activeTab, setActiveTab] = useState<TypeSetupTab>('extraction');

  const tabs = [
    ...(currentUser.permissions.extractionTypes ? [{ id: 'extraction' as TypeSetupTab, label: 'Extraction Types', icon: FileText, description: 'Manage PDF extraction templates' }] : []),
    ...(currentUser.permissions.transformationTypes ? [{ id: 'transformation' as TypeSetupTab, label: 'Transformation Types', icon: RefreshCw, description: 'Manage PDF transformation and renaming' }] : []),
    ...(currentUser.permissions.workflowManagement ? [{ id: 'workflows' as TypeSetupTab, label: 'Workflows', icon: GitBranch, description: 'Create multi-step processes' }] : [])
  ];

  const renderTabContent = (refreshData: () => Promise<void>) => {
    switch (activeTab) {
      case 'extraction':
        return currentUser.permissions.extractionTypes ? (
          <ExtractionTypesSettings
            extractionTypes={extractionTypes}
            onUpdateExtractionTypes={onUpdateExtractionTypes}
            onDeleteExtractionType={onDeleteExtractionType}
          />
        ) : <PermissionDenied />;
      case 'transformation':
        return currentUser.permissions.transformationTypes ? (
          <TransformationTypesSettings
            transformationTypes={transformationTypes}
            refreshData={refreshData}
            onUpdateTransformationTypes={onUpdateTransformationTypes}
            onDeleteTransformationType={onDeleteTransformationType}
          />
        ) : <PermissionDenied />;
      case 'workflows':
        return currentUser.permissions.workflowManagement ? (
          <WorkflowSettings 
            apiConfig={apiConfig} 
            refreshData={refreshData}
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
        {renderTabContent(refreshData)}
      </div>
    </div>
  );
}

function PermissionDenied() {
  return (
    <div className="text-center py-12">
      <div className="bg-red-100 dark:bg-red-900/50 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
      <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this section.</p>
      <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">Contact your administrator to request access.</p>
    </div>
  );
}