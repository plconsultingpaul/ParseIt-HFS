import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout';
import ExtractPage from './components/ExtractPage';
import SettingsPage from './components/SettingsPage';
import { useSupabaseData } from './hooks/useSupabaseData';
import { Loader2 } from 'lucide-react';
import type { ExtractionType, SftpConfig, SettingsConfig, ApiConfig, EmailMonitoringConfig, EmailProcessingRule, User, SecuritySettings, EmailPollingLog } from './types';

export default function App() {
  const { 
    isAuthenticated, 
    user, 
    loading: authLoading, 
    login, 
    logout,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser
  } = useAuth();
  const [currentPage, setCurrentPage] = useState<'extract' | 'settings'>('extract');
  const {
    extractionTypes,
    sftpConfig,
    settingsConfig,
    apiConfig,
    emailConfig,
    emailRules,
    processedEmails,
    extractionLogs,
    users,
    workflows,
    workflowSteps,
    emailPollingLogs,
    workflowExecutionLogs,
    loading,
    refreshData,
    refreshLogs,
    refreshLogsWithFilters,
    refreshProcessedEmails,
    refreshWorkflowExecutionLogs,
    updateExtractionTypes,
    updateSftpConfig,
    updateSettingsConfig,
    updateApiConfig,
    updateEmailConfig,
    updateEmailRules,
    refreshPollingLogs,
    logExtraction
  } = useSupabaseData();

  // Always navigate to extract page when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      setCurrentPage('extract');
    }
  }, [isAuthenticated, user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="text-lg font-medium text-purple-600">
            {authLoading ? 'Checking authentication...' : 'Loading your data...'}
          </span>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated || !user) {
    return <LoginPage onLogin={login} />;
  }

  const handleNavigate = (page: 'extract' | 'settings') => {
    if (page === 'settings' && !user.isAdmin) {
      alert('You do not have permission to access settings.');
      return;
    }
    setCurrentPage(page);
  };

  const handleUpdateExtractionTypes = async (types: ExtractionType[]) => {
    try {
      await updateExtractionTypes(types);
    } catch (error) {
      console.error('Failed to update extraction types:', error);
      alert('Failed to save extraction types. Please try again.');
    }
  };

  const handleUpdateSftpConfig = async (config: SftpConfig) => {
    try {
      await updateSftpConfig(config);
    } catch (error) {
      console.error('Failed to update SFTP config:', error);
      alert('Failed to save SFTP configuration. Please try again.');
    }
  };

  const handleUpdateSettingsConfig = async (config: SettingsConfig) => {
    try {
      await updateSettingsConfig(config);
    } catch (error) {
      console.error('Failed to update settings config:', error);
      alert('Failed to save settings configuration. Please try again.');
    }
  };

  const handleUpdateApiConfig = async (config: ApiConfig) => {
    try {
      await updateApiConfig(config);
    } catch (error) {
      console.error('Failed to update API config:', error);
      alert('Failed to save API configuration. Please try again.');
    }
  };

  const handleUpdateEmailConfig = async (config: EmailMonitoringConfig) => {
    try {
      await updateEmailConfig(config);
    } catch (error) {
      console.error('Failed to update email config:', error);
      alert('Failed to save email configuration. Please try again.');
    }
  };

  const handleUpdateEmailRules = async (rules: EmailProcessingRule[]) => {
    try {
      await updateEmailRules(rules);
    } catch (error) {
      console.error('Failed to update email rules:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Detailed error:', errorMessage);
      throw new Error(`Failed to save email processing rules: ${errorMessage}`);
    }
  };

  return (
    <Layout 
      currentPage={currentPage} 
      onNavigate={handleNavigate}
      user={user}
      onLogout={logout}
    >
      {currentPage === 'extract' && (
        <ExtractPage
          extractionTypes={extractionTypes}
          sftpConfig={sftpConfig}
          settingsConfig={settingsConfig}
          apiConfig={apiConfig}
          onNavigateToSettings={() => setCurrentPage('settings')}
        />
      )}
      {currentPage === 'settings' && (
        <SettingsPage
          extractionTypes={extractionTypes}
          sftpConfig={sftpConfig}
          settingsConfig={settingsConfig}
          apiConfig={apiConfig}
          emailConfig={emailConfig}
          emailRules={emailRules}
          processedEmails={processedEmails}
          extractionLogs={extractionLogs}
          users={users}
          currentUser={user}
          emailPollingLogs={emailPollingLogs}
          workflowExecutionLogs={workflowExecutionLogs}
          workflows={workflows}
          workflowSteps={workflowSteps}
          workflows={workflows}
          workflowSteps={workflowSteps}
          getAllUsers={getAllUsers}
          createUser={createUser}
          updateUser={updateUser}
          deleteUser={deleteUser}
          onUpdateExtractionTypes={handleUpdateExtractionTypes}
          onUpdateSftpConfig={handleUpdateSftpConfig}
          onUpdateSettingsConfig={handleUpdateSettingsConfig}
          onUpdateApiConfig={handleUpdateApiConfig}
          onUpdateEmailConfig={handleUpdateEmailConfig}
          onUpdateEmailRules={handleUpdateEmailRules}
          onRefreshLogs={refreshLogs}
          onRefreshLogsWithFilters={refreshLogsWithFilters}
          onRefreshPollingLogs={refreshPollingLogs}
          onRefreshWorkflowLogs={refreshWorkflowExecutionLogs}
          onRefreshProcessedEmails={refreshProcessedEmails}
        />
      )}
    </Layout>
  );
}