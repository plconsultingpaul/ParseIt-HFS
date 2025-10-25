import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginPage from './components/LoginPage';
import Layout from './components/Layout';
import ExtractPage from './components/ExtractPage';
import TransformPage from './components/TransformPage';
import SettingsPage from './components/SettingsPage';
import LogsPage from './components/LogsPage';
import TypeSetupPage from './components/TypeSetupPage';
import VendorUploadPage from './components/VendorUploadPage';
import OrdersPage from './components/OrdersPage';
import { useSupabaseData } from './hooks/useSupabaseData';
import { Loader2 } from 'lucide-react';
import type { ExtractionType, TransformationType, SftpConfig, SettingsConfig, ApiConfig, EmailMonitoringConfig, EmailProcessingRule, User, SecuritySettings, CompanyBranding } from './types';

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
  const [currentPage, setCurrentPage] = useState<'extract' | 'vendor' | 'orders' | 'transform' | 'types' | 'settings' | 'logs'>('extract');
  const {
    extractionTypes,
    transformationTypes,
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
    sftpPollingLogs,
    loading,
    refreshData,
    companyBranding,
    refreshLogs,
    refreshLogsWithFilters,
    refreshProcessedEmails,
    refreshWorkflowExecutionLogs,
    refreshSftpPollingLogs,
    updateSftpPollingConfigs,
    updateExtractionTypes,
    updateSftpConfig,
    updateSettingsConfig,
    updateApiConfig,
    updateEmailConfig,
    updateEmailRules,
    refreshPollingLogs,
    logExtraction,
    updateCompanyBranding,
    deleteExtractionType,
    updateTransformationTypes,
    deleteTransformationType
  } = useSupabaseData();

  // Always navigate to extract page when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      // Navigate vendors to their dedicated upload page
      if (user.role === 'vendor') {
        setCurrentPage('orders');
      } else {
        setCurrentPage('extract');
      }
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
    return <LoginPage companyBranding={companyBranding} onLogin={login} />;
  }

  const handleNavigate = (page: 'extract' | 'vendor' | 'orders' | 'transform' | 'types' | 'settings' | 'logs') => {
    if (page === 'settings' && !user.isAdmin) {
      alert('You do not have permission to access settings.');
      return;
    }
    if ((page === 'types' || page === 'logs' || page === 'settings' || page === 'transform' || page === 'extract') && user.role === 'vendor') {
      alert('You do not have permission to access this section.');
      return;
    }
    if (page === 'orders' && user.role !== 'vendor') {
      alert('This page is only available for vendor accounts.');
      return;
    }
    if (page === 'vendor' && user.role !== 'vendor') {
      alert('This page is only available for vendor accounts.');
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

  const handleDeleteExtractionType = async (id: string) => {
    try {
      await deleteExtractionType(id);
    } catch (error) {
      console.error('Failed to delete extraction type:', error);
      alert('Failed to delete extraction type. Please try again.');
    }
  };

  const handleUpdateTransformationTypes = async (types: TransformationType[]) => {
    try {
      await updateTransformationTypes(types);
    } catch (error) {
      console.error('Failed to update transformation types:', error);
      alert('Failed to save transformation types. Please try again.');
    }
  };

  const handleDeleteTransformationType = async (id: string) => {
    try {
      await deleteTransformationType(id);
    } catch (error) {
      console.error('Failed to delete transformation type:', error);
      alert('Failed to delete transformation type. Please try again.');
    }
  };

  const handleUpdateCompanyBranding = async (branding: CompanyBranding) => {
    try {
      await updateCompanyBranding(branding);
    } catch (error) {
      console.error('Failed to update company branding:', error);
      alert('Failed to save company branding. Please try again.');
    }
  };

  return (
    <Layout 
      currentPage={currentPage} 
      onNavigate={handleNavigate}
      user={user}
      companyBranding={companyBranding}
      onLogout={logout}
    >
      {currentPage === 'extract' && (
        <ExtractPage
          extractionTypes={extractionTypes}
          transformationTypes={transformationTypes}
          sftpConfig={sftpConfig}
          settingsConfig={settingsConfig}
          apiConfig={apiConfig}
          onNavigateToSettings={() => setCurrentPage('settings')}
        />
      )}
      {currentPage === 'vendor' && (
        <VendorUploadPage
          transformationTypes={transformationTypes}
          sftpConfig={sftpConfig}
          settingsConfig={settingsConfig}
          apiConfig={apiConfig}
          workflowSteps={workflowSteps}
        />
      )}
      {currentPage === 'orders' && (
        <OrdersPage
          user={user}
          apiConfig={apiConfig}
        />
      )}
      {currentPage === 'transform' && (
        <TransformPage
          transformationTypes={transformationTypes}
          sftpConfig={sftpConfig}
          settingsConfig={settingsConfig}
          apiConfig={apiConfig}
          onNavigateToSettings={() => setCurrentPage('settings')}
        />
      )}
      {currentPage === 'logs' && (
        <LogsPage
          extractionLogs={extractionLogs}
          extractionTypes={extractionTypes}
          transformationTypes={transformationTypes}
          users={users}
          emailPollingLogs={emailPollingLogs}
          workflowExecutionLogs={workflowExecutionLogs}
          workflows={workflows}
          workflowSteps={workflowSteps}
          sftpPollingLogs={sftpPollingLogs}
          processedEmails={processedEmails}
          onRefreshLogs={refreshLogs}
          onRefreshLogsWithFilters={refreshLogsWithFilters}
          onRefreshPollingLogs={refreshPollingLogs}
          onRefreshWorkflowLogs={refreshWorkflowExecutionLogs}
          onRefreshSftpPollingLogs={refreshSftpPollingLogs}
          onRefreshProcessedEmails={refreshProcessedEmails}
        />
      )}
      {currentPage === 'types' && (
        <TypeSetupPage
          extractionTypes={extractionTypes}
          transformationTypes={transformationTypes}
          workflows={workflows}
          workflowSteps={workflowSteps}
          apiConfig={apiConfig}
          currentUser={user}
          refreshData={refreshData}
          onUpdateExtractionTypes={handleUpdateExtractionTypes}
          onDeleteExtractionType={handleDeleteExtractionType}
          onUpdateTransformationTypes={handleUpdateTransformationTypes}
          onDeleteTransformationType={handleDeleteTransformationType}
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
          users={users}
          currentUser={user}
          workflows={workflows}
          workflowSteps={workflowSteps}
          companyBranding={companyBranding}
          processedEmails={processedEmails}
          getAllUsers={getAllUsers}
          createUser={createUser}
          updateUser={updateUser}
          deleteUser={deleteUser}
          onUpdateExtractionTypes={handleUpdateExtractionTypes}
          onDeleteExtractionType={handleDeleteExtractionType}
          onUpdateTransformationTypes={handleUpdateTransformationTypes}
          onDeleteTransformationType={handleDeleteTransformationType}
          onUpdateSftpConfig={handleUpdateSftpConfig}
          onUpdateSettingsConfig={handleUpdateSettingsConfig}
          onUpdateApiConfig={handleUpdateApiConfig}
          onUpdateEmailConfig={handleUpdateEmailConfig}
          onUpdateEmailRules={handleUpdateEmailRules}
          onUpdateSftpPollingConfigs={updateSftpPollingConfigs}
          onUpdateCompanyBranding={handleUpdateCompanyBranding}
          transformationTypes={transformationTypes}
        />
      )}
    </Layout>
  );
}