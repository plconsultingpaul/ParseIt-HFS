import React, { useState } from 'react';
import { Settings, FileText, LogOut, User, HelpCircle, Menu, X, BarChart3, RefreshCw, Database, Building } from 'lucide-react';
import type { User as UserType } from '../types';
import type { CompanyBranding } from '../types';
import DarkModeToggle from './DarkModeToggle';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'extract' | 'vendor' | 'orders' | 'transform' | 'types' | 'settings' | 'logs';
  onNavigate: (page: 'extract' | 'vendor' | 'orders' | 'transform' | 'types' | 'settings' | 'logs') => void;
  user: UserType;
  companyBranding?: CompanyBranding;
  onLogout: () => void;
}

export default function Layout({ children, currentPage, onNavigate, user, companyBranding, onLogout }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  // Debug logging to track user state changes
  React.useEffect(() => {
    console.log('Layout - User state changed:', {
      userId: user?.id,
      username: user?.username,
      role: user?.role,
      isAdmin: user?.isAdmin
    });
  }, [user]);

  // Determine if sidebar should be expanded (either not collapsed or being hovered)
  const isSidebarExpanded = !isSidebarCollapsed || isSidebarHovered;

  const handleSettingsClick = () => {
    // Check for non-type-setup permissions (exclude extractionTypes, transformationTypes, workflowManagement)
    const nonTypePermissions = {
      sftp: user.permissions.sftp,
      api: user.permissions.api,
      emailMonitoring: user.permissions.emailMonitoring,
      emailRules: user.permissions.emailRules,
      processedEmails: user.permissions.processedEmails,
      extractionLogs: user.permissions.extractionLogs,
      userManagement: user.permissions.userManagement
    };
    const hasAnyPermission = Object.values(nonTypePermissions).some(permission => permission === true);
    
    if (!hasAnyPermission) {
      alert('You do not have permission to access settings. Contact your administrator to request access.');
      return;
    }
    onNavigate('settings');
  };

  // Memoize navigation items to prevent recreation on every render
  const navigationItems = React.useMemo(() => [
    {
      id: 'extract',
      label: 'Extract',
      icon: FileText,
      onClick: () => onNavigate('extract'),
      requiresPermission: false,
      roles: ['admin', 'user']
    },
    {
      id: 'vendor',
      label: 'Upload PDFs',
      icon: FileText,
      onClick: () => onNavigate('vendor'),
      requiresPermission: false,
      roles: ['vendor']
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: Database,
      onClick: () => onNavigate('orders'),
      requiresPermission: false,
      roles: ['vendor']
    },
    {
      id: 'transform',
      label: 'Transform',
      icon: RefreshCw,
      onClick: () => onNavigate('transform'),
      requiresPermission: false,
      roles: ['admin', 'user']
    },
    {
      id: 'types',
      label: 'Type Setup',
      icon: Database,
      onClick: () => onNavigate('types'),
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: BarChart3,
      onClick: () => onNavigate('logs'),
      requiresPermission: false,
      roles: ['admin', 'user']
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onClick: handleSettingsClick,
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'help',
      label: 'Help',
      icon: HelpCircle,
      onClick: () => window.open('/help', '_blank'),
      requiresPermission: false,
      roles: ['admin', 'user']
    }
  ], [user.role]);

  // Filter navigation items based on user role
  const filteredNavigationItems = React.useMemo(() => {
    console.log('Filtering navigation items for user:', user);
    
    // Wait for user to be fully loaded with role
    if (!user || !user.role) {
      console.log('User or role not available yet, returning empty navigation');
      return [];
    }
    
    console.log('User role confirmed:', user.role);
    
    // Filter items based on role inclusion
    const filteredItems = navigationItems.filter(item => {
      // Check if user role is included in item's allowed roles
      return item.roles.includes(user.role);
    });
    
    console.log('Filtered navigation items:', filteredItems);
    return filteredItems;
  }, [user, navigationItems]);

  return (
    <div className="h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <div className={`bg-white/90 backdrop-blur-sm border-r border-purple-100 flex flex-col transition-all duration-300 ease-in-out h-full ${
        isSidebarExpanded ? 'w-64' : 'w-16'
      } dark:bg-gray-800/90 dark:border-gray-700`}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-purple-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-3 transition-opacity duration-200 ${
              isSidebarExpanded ? 'opacity-100' : 'opacity-0'
            }`}>
              {companyBranding?.logoUrl && (
                <img
                  src={companyBranding.logoUrl}
                  alt="Company Logo"
                  className="h-8 w-auto max-w-20 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    ParseIt
                  </h1>
                  {companyBranding?.showCompanyName && companyBranding?.companyName && (
                    <>
                      <span className="text-gray-400 dark:text-gray-500 text-sm">•</span>
                      <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        {companyBranding.companyName}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  PDF Data Extraction
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 overflow-y-auto min-h-0">
          <div className="space-y-2">
            {filteredNavigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700'
                  }`}
                  title={!isSidebarExpanded ? item.label : undefined}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                    }`} />
                    <span className={`font-medium transition-opacity duration-200 ${
                      isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* User Info & Logout */}
        <div className="p-3 border-t border-purple-100 dark:border-gray-700 flex-shrink-0 bg-white/90 dark:bg-gray-800/90">
          {isSidebarExpanded ? (
            <div className="transition-opacity duration-200 opacity-100">
              <div className="flex items-center space-x-3 mb-3 px-3 py-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                <User className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300 block truncate">{user.username}</span>
                  {user.isAdmin && (
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200 text-xs font-medium rounded-full">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="flex items-center space-x-2">
                {companyBranding?.logoUrl && (
                  <img
                    src={companyBranding.logoUrl}
                    alt="Company Logo"
                    className="h-6 w-auto max-w-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg" title={`${user.username}${user.isAdmin ? ' (Admin)' : ''}`}>
                  <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>
          )}
          
          {/* Dark Mode Toggle */}
          <div className={`mb-3 ${isSidebarExpanded ? 'px-3' : 'flex justify-center'}`}>
            <DarkModeToggle size="sm" />
          </div>
          
          <button
            onClick={onLogout}
            className={`w-full p-3 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200 flex items-center ${
              isSidebarExpanded ? 'space-x-3' : 'justify-center'
            } dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20`}
            title={!isSidebarExpanded ? 'Sign Out' : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className={`font-medium transition-opacity duration-200 ${
              isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'
            }`}>
              Sign Out
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-purple-100 dark:border-gray-700 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4">
                {companyBranding?.logoUrl && (
                  <img
                    src={companyBranding.logoUrl}
                    alt="Company Logo"
                    className="h-10 w-auto max-w-32 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {currentPage === 'extract' && 'Upload & Extract'}
                      {currentPage === 'vendor' && 'Upload PDFs'}
                      {currentPage === 'orders' && 'Orders Dashboard'}
                      {currentPage === 'transform' && 'Transform & Rename'}
                      {currentPage === 'types' && 'Type Setup'}
                      {currentPage === 'settings' && 'Settings'}
                      {currentPage === 'logs' && 'Activity Logs'}
                    </h2>
                    {companyBranding?.showCompanyName && companyBranding?.companyName && (
                      <span className="text-lg font-medium text-gray-600 dark:text-gray-400">
                        - {companyBranding.companyName}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {currentPage === 'extract' && (user.role === 'vendor' ? 'Upload your PDF documents for automated processing' : 'Upload PDFs and extract structured data')}
                    {currentPage === 'vendor' && 'Upload your PDF documents for intelligent processing and renaming'}
                    {currentPage === 'orders' && 'View and manage your orders from the system'}
                    {currentPage === 'transform' && 'Extract data from PDFs to intelligently rename files'}
                    {currentPage === 'types' && 'Configure extraction types, transformation types, and workflows'}
                    {currentPage === 'settings' && 'Configure ParseIt settings and preferences'}
                    {currentPage === 'logs' && 'Monitor system activity and processing logs'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <DarkModeToggle size="md" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}