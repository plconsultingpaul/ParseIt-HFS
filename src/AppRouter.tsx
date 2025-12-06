import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSupabaseData } from './hooks/useSupabaseData';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { Loader2 } from 'lucide-react';

import LoginPage from './components/LoginPage';
import DriverCheckinPage from './components/DriverCheckinPage';
import LayoutRouter from './components/LayoutRouter';
import PrivateRoute from './components/router/PrivateRoute';
import RoleBasedRoute from './components/router/RoleBasedRoute';
import NotFound from './components/router/NotFound';

import ExtractPage from './components/ExtractPage';
import TransformPage from './components/TransformPage';
import SettingsPage from './components/SettingsPage';
import LogsPage from './components/LogsPage';
import TypeSetupPage from './components/TypeSetupPage';
import VendorSetupPage from './components/VendorSetupPage';
import CheckInSetupPage from './components/CheckInSetupPage';
import ClientSetupPage from './components/ClientSetupPage';
import OrderEntryPage from './components/OrderEntryPage';
import OrderEntrySubmissionsPage from './components/OrderEntrySubmissionsPage';
import OrderEntrySubmissionDetailPage from './components/OrderEntrySubmissionDetailPage';
import RateQuotePage from './components/RateQuotePage';
import AddressBookPage from './components/AddressBookPage';

import type { ExtractionType, TransformationType, SftpConfig, SettingsConfig, ApiConfig, EmailMonitoringConfig, EmailProcessingRule } from './types';

function AppContent() {
  const {
    isAuthenticated,
    user,
    loading: authLoading,
    login,
    logout,
    getAllUsers,
    createUser,
    updateUser,
    deleteUser,
    updateUserPassword,
    getUserExtractionTypes,
    updateUserExtractionTypes,
    getUserTransformationTypes,
    updateUserTransformationTypes
  } = useAuth();

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
    featureFlags,
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
    updateFeatureFlags,
    deleteExtractionType,
    updateTransformationTypes,
    deleteTransformationType
  } = useSupabaseData();

  const location = useLocation();

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          <span className="text-lg font-medium text-purple-600 dark:text-purple-400">
            {authLoading ? 'Checking authentication...' : 'Loading your data...'}
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginPage companyBranding={companyBranding} onLogin={login} />;
  }

  return (
    <Routes>
      <Route path="/driver-checkin" element={<DriverCheckinPage />} />
      <Route path="/checkin" element={<DriverCheckinPage />} />

      <Route path="/" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
            {user.role === 'client' ? (
              user.hasOrderEntryAccess ? (
                <Navigate to="/order-entry" replace />
              ) : user.hasRateQuoteAccess ? (
                <Navigate to="/rate-quote" replace />
              ) : user.isClientAdmin ? (
                <Navigate to="/client-users" replace />
              ) : (
                <Navigate to="/order-entry" replace />
              )
            ) : (
              <Navigate to="/extract" replace />
            )}
          </LayoutRouter>
        </PrivateRoute>
      } />

      <Route path="/extract" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            customCheck={(u) => u.role === 'admin' || u.role === 'user'}
            deniedMessage="You do not have permission to access the Extract page."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <ExtractPage
                extractionTypes={extractionTypes}
                transformationTypes={transformationTypes}
                sftpConfig={sftpConfig}
                settingsConfig={settingsConfig}
                apiConfig={apiConfig}
                onNavigateToSettings={() => {}}
              />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/transform" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            customCheck={(u) => u.role === 'admin' || u.role === 'user'}
            deniedMessage="You do not have permission to access the Transform page."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <TransformPage
                transformationTypes={transformationTypes}
                sftpConfig={sftpConfig}
                settingsConfig={settingsConfig}
                apiConfig={apiConfig}
                onNavigateToSettings={() => {}}
                getUserTransformationTypes={getUserTransformationTypes}
              />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/types" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            customCheck={(u) => u.role === 'admin' || u.role === 'user'}
            deniedMessage="You do not have permission to access the Type Setup page."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
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
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/vendor-setup" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            requirePermission="userManagement"
            deniedTitle="Vendor Setup Access Denied"
            deniedMessage="You do not have permission to access Vendor Setup. This section requires user management privileges."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <VendorSetupPage
                currentUser={user}
                apiConfig={apiConfig}
                extractionTypes={extractionTypes}
                transformationTypes={transformationTypes}
                getAllUsers={getAllUsers}
                createUser={createUser}
                updateUser={updateUser}
                deleteUser={deleteUser}
                updateUserPassword={updateUserPassword}
                onUpdateApiConfig={handleUpdateApiConfig}
              />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/checkin-setup" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            customCheck={(u) => u.isAdmin === true}
            deniedTitle="Check-In Setup Access Denied"
            deniedMessage="You do not have permission to access Check-In Setup. This section requires administrator privileges."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <CheckInSetupPage workflows={workflows} />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/client-setup" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            requirePermission="userManagement"
            deniedTitle="Client Setup Access Denied"
            deniedMessage="You do not have permission to access Client Setup. This section requires user management privileges."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <ClientSetupPage
                currentUser={user}
                extractionTypes={extractionTypes}
                transformationTypes={transformationTypes}
                getAllUsers={getAllUsers}
                createUser={createUser}
                updateUser={updateUser}
                deleteUser={deleteUser}
                updateUserPassword={updateUserPassword}
              />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/order-entry" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            requireClientAccess="orderEntry"
            deniedTitle="Order Entry Access Denied"
            deniedMessage="You do not have permission to access Order Entry. This feature is only available to client users with appropriate access."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <OrderEntryPage currentUser={user} />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/order-entry/submissions" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            customCheck={(u) => u.role === 'admin' || u.role === 'user'}
            deniedMessage="You do not have permission to access submissions."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <OrderEntrySubmissionsPage currentUser={user} />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/order-entry/submissions/:id" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            customCheck={(u) => u.role === 'admin' || u.role === 'user'}
            deniedMessage="You do not have permission to view submission details."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <OrderEntrySubmissionDetailPage currentUser={user} />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/rate-quote" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            requireClientAccess="rateQuote"
            deniedTitle="Rate Quote Access Denied"
            deniedMessage="You do not have permission to access Rate Quote. This feature is only available to client users with appropriate access."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <RateQuotePage />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/address-book" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            requireClientAccess="addressBook"
            deniedTitle="Address Book Access Denied"
            deniedMessage="You do not have permission to access Address Book. This feature is only available to client users with appropriate access."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <AddressBookPage user={user} />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/client-users" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            requireClientAccess="clientAdmin"
            deniedTitle="User Management Access Denied"
            deniedMessage="You do not have permission to access User Management. This feature is only available to client administrators."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
              <ClientSetupPage
                currentUser={user}
                extractionTypes={extractionTypes}
                transformationTypes={transformationTypes}
                getAllUsers={getAllUsers}
                createUser={createUser}
                updateUser={updateUser}
                deleteUser={deleteUser}
                updateUserPassword={updateUserPassword}
              />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/logs" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            customCheck={(u) => u.role === 'admin' || u.role === 'user'}
            deniedMessage="You do not have permission to access logs."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
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
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="/settings" element={
        <PrivateRoute isAuthenticated={isAuthenticated} user={user}>
          <RoleBasedRoute
            user={user}
            customCheck={(u) => {
              const nonTypePermissions = {
                sftp: u.permissions.sftp,
                api: u.permissions.api,
                emailMonitoring: u.permissions.emailMonitoring,
                emailRules: u.permissions.emailRules,
                processedEmails: u.permissions.processedEmails,
                extractionLogs: u.permissions.extractionLogs,
                userManagement: u.permissions.userManagement
              };
              return Object.values(nonTypePermissions).some(permission => permission === true);
            }}
            deniedTitle="Settings Access Denied"
            deniedMessage="You do not have permission to access the Settings page. This section requires administrative privileges to configure system settings, manage users, or adjust integrations."
          >
            <LayoutRouter user={user} companyBranding={companyBranding} onLogout={logout}>
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
                updateUserPassword={updateUserPassword}
                getUserExtractionTypes={getUserExtractionTypes}
                updateUserExtractionTypes={updateUserExtractionTypes}
                getUserTransformationTypes={getUserTransformationTypes}
                updateUserTransformationTypes={updateUserTransformationTypes}
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
                onUpdateCompanyBranding={updateCompanyBranding}
                onUpdateFeatureFlags={updateFeatureFlags}
                transformationTypes={transformationTypes}
                featureFlags={featureFlags}
              />
            </LayoutRouter>
          </RoleBasedRoute>
        </PrivateRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <DarkModeProvider>
        <AppContent />
      </DarkModeProvider>
    </BrowserRouter>
  );
}
