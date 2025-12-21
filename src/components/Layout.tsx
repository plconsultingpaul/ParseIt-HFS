import React, { useState, useEffect } from 'react';
import { Settings, FileText, LogOut, User, HelpCircle, Menu, X, BarChart3, RefreshCw, Database, Building, Package, ClipboardCheck, Building2, DollarSign, Users as UsersIcon, BookUser, ClipboardList, Brain, MapPin, Receipt } from 'lucide-react';
import type { User as UserType } from '../types';
import type { CompanyBranding } from '../types';
import DarkModeToggle from './DarkModeToggle';
import PermissionDeniedModal from './common/PermissionDeniedModal';
import { geminiConfigService } from '../services/geminiConfigService';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'extract' | 'vendor-setup' | 'checkin-setup' | 'client-setup' | 'transform' | 'types' | 'settings' | 'logs' | 'order-entry' | 'order-submissions' | 'order-submission-detail' | 'rate-quote' | 'client-users' | 'address-book' | 'track-trace' | 'invoices';
  onNavigate: (page: 'extract' | 'vendor-setup' | 'checkin-setup' | 'client-setup' | 'transform' | 'types' | 'settings' | 'logs' | 'order-entry' | 'order-submissions' | 'rate-quote' | 'client-users' | 'address-book' | 'track-trace' | 'invoices') => void;
  user: UserType;
  companyBranding?: CompanyBranding;
  onLogout: () => void;
}

export default function Layout({ children, currentPage, onNavigate, user, companyBranding, onLogout }: LayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [activeModelName, setActiveModelName] = useState<string>('');
  const [permissionDenied, setPermissionDenied] = useState<{
    isOpen: boolean;
    message: string;
    title?: string;
  }>({
    isOpen: false,
    message: ''
  });

  useEffect(() => {
    const fetchActiveModel = async () => {
      try {
        const config = await geminiConfigService.getActiveConfiguration();
        if (config && config.modelName) {
          const displayName = config.modelName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          setActiveModelName(displayName);
        }
      } catch (error) {
        console.error('Failed to fetch active Gemini model:', error);
      }
    };

    fetchActiveModel();
  }, []);

  // Determine if sidebar should be expanded (either not collapsed or being hovered)
  const isSidebarExpanded = !isSidebarCollapsed || isSidebarHovered;

  const handleSettingsClick = React.useCallback(() => {
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
      setPermissionDenied({
        isOpen: true,
        message: 'You do not have permission to access the Settings page. This section requires administrative privileges to configure system settings, manage users, or adjust integrations.',
        title: 'Settings Access Denied'
      });
      return;
    }
    onNavigate('settings');
  }, [user, onNavigate, setPermissionDenied]);

  // Memoize navigation items to prevent recreation on every render
  const navigationItems = React.useMemo(() => [
    // Client user navigation items
    {
      id: 'order-entry',
      label: 'Order Entry',
      icon: FileText,
      onClick: () => onNavigate('order-entry'),
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'rate-quote',
      label: 'Rate Quote',
      icon: DollarSign,
      onClick: () => onNavigate('rate-quote'),
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'address-book',
      label: 'Address Book',
      icon: BookUser,
      onClick: () => onNavigate('address-book'),
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'track-trace',
      label: 'Track & Trace',
      icon: MapPin,
      onClick: () => onNavigate('track-trace'),
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'invoices',
      label: 'Invoices',
      icon: Receipt,
      onClick: () => onNavigate('invoices'),
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'client-users',
      label: 'Users',
      icon: UsersIcon,
      onClick: () => onNavigate('client-users'),
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'extract',
      label: 'Extract',
      icon: FileText,
      onClick: () => onNavigate('extract'),
      requiresPermission: false,
      roles: ['admin', 'user']
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
      id: 'vendor-setup',
      label: 'Vendor Setup',
      icon: Package,
      onClick: () => onNavigate('vendor-setup'),
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'client-setup',
      label: 'Client Setup',
      icon: Building2,
      onClick: () => onNavigate('client-setup'),
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'checkin-setup',
      label: 'Check-In Setup',
      icon: ClipboardCheck,
      onClick: () => onNavigate('checkin-setup'),
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
      roles: ['admin', 'user', 'client', 'vendor']
    }
  ], [user.role, handleSettingsClick]);

  // Filter navigation items based on user role and permissions
  const filteredNavigationItems = React.useMemo(() => {
    // Wait for user to be fully loaded with role
    if (!user || !user.role) {
      return [];
    }

    // Filter items based on role inclusion and permissions
    const filteredItems = navigationItems.filter(item => {
      // Check if user role is included in item's allowed roles
      if (!item.roles.includes(user.role)) {
        return false;
      }

      // For vendor-setup, check userManagement permission
      if (item.id === 'vendor-setup' && !user.permissions.userManagement) {
        return false;
      }

      // For client-setup, check userManagement permission
      if (item.id === 'client-setup' && !user.permissions.userManagement) {
        return false;
      }

      // For checkin-setup, only admin users can access
      if (item.id === 'checkin-setup' && !user.isAdmin) {
        return false;
      }

      // For order-entry, check if client user has access
      if (item.id === 'order-entry' && (!user.hasOrderEntryAccess || user.role !== 'client')) {
        return false;
      }

      // For rate-quote, check if client user has access
      if (item.id === 'rate-quote' && (!user.hasRateQuoteAccess || user.role !== 'client')) {
        return false;
      }

      // For address-book, check if client user has access (Client Admins always have access)
      if (item.id === 'address-book' && user.role !== 'client') {
        return false;
      }
      if (item.id === 'address-book' && user.role === 'client' && !user.isClientAdmin && !user.hasAddressBookAccess) {
        return false;
      }

      // For track-trace, check if client user has access
      if (item.id === 'track-trace' && (!user.hasTrackTraceAccess || user.role !== 'client')) {
        return false;
      }

      // For invoices, check if client user has access
      if (item.id === 'invoices' && (!user.hasInvoiceAccess || user.role !== 'client')) {
        return false;
      }

      // For client-users, check if user is a client admin
      if (item.id === 'client-users' && (!user.isClientAdmin || user.role !== 'client')) {
        return false;
      }

      return true;
    });

    return filteredItems;
  }, [user, navigationItems]);

  return (
    <>
      <PermissionDeniedModal
        isOpen={permissionDenied.isOpen}
        onClose={() => setPermissionDenied({ isOpen: false, message: '' })}
        message={permissionDenied.message}
        title={permissionDenied.title}
      />
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
              {companyBranding?.logoUrl ? (
                <img
                  src={companyBranding.logoUrl}
                  alt="Company Logo"
                  className="h-8 w-auto max-w-20 object-contain"
                />
              ) : (
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 rounded-lg">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  {companyBranding?.showCompanyName && companyBranding?.companyName
                    ? companyBranding.companyName
                    : 'Parse-It'}
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {companyBranding?.showCompanyName && companyBranding?.companyName
                    ? 'Powered by Parse-It'
                    : 'PDF Data Extraction'}
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

        {/* Active Gemini Model */}
        {activeModelName && (
          <div className="px-3 py-2 border-t border-purple-100 dark:border-gray-700 flex-shrink-0">
            <div className={`flex items-center ${isSidebarExpanded ? 'space-x-2 px-3 py-2' : 'justify-center py-2'} bg-blue-50 dark:bg-blue-900/20 rounded-lg`}>
              <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              {isSidebarExpanded && (
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                  {activeModelName}
                </span>
              )}
            </div>
          </div>
        )}

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
              <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg" title={`${user.username}${user.isAdmin ? ' (Admin)' : ''}`}>
                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {currentPage === 'extract' && 'Upload & Extract'}
                    {currentPage === 'vendor-setup' && 'Vendor Setup'}
                    {currentPage === 'checkin-setup' && 'Check-In Setup'}
                    {currentPage === 'client-setup' && 'Client Setup'}
                    {currentPage === 'transform' && 'Transform & Rename'}
                    {currentPage === 'types' && 'Type Setup'}
                    {currentPage === 'settings' && 'Settings'}
                    {currentPage === 'logs' && 'Activity Logs'}
                    {currentPage === 'order-entry' && 'Order Entry'}
                    {currentPage === 'rate-quote' && 'Rate Quote'}
                    {currentPage === 'address-book' && 'Address Book'}
                    {currentPage === 'track-trace' && 'Track & Trace'}
                    {currentPage === 'invoices' && 'Invoices'}
                    {currentPage === 'client-users' && 'User Management'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {currentPage === 'extract' && (user.role === 'vendor' ? 'Upload your PDF documents for automated processing' : 'Upload PDFs and extract structured data')}
                    {currentPage === 'vendor-setup' && 'Manage vendor accounts and configure orders display settings'}
                    {currentPage === 'checkin-setup' && 'Configure driver check-in system and manage driver information'}
                    {currentPage === 'client-setup' && 'Manage client companies and their users'}
                    {currentPage === 'transform' && 'Extract data from PDFs to intelligently rename files'}
                    {currentPage === 'types' && 'Configure extraction types, transformation types, and workflows'}
                    {currentPage === 'settings' && 'Configure Parse-It settings and preferences'}
                    {currentPage === 'logs' && 'Monitor system activity and processing logs'}
                    {currentPage === 'order-entry' && 'Create and manage orders for your organization'}
                    {currentPage === 'rate-quote' && 'Request and manage pricing quotes'}
                    {currentPage === 'address-book' && 'Manage customer shipping and receiving addresses'}
                    {currentPage === 'track-trace' && 'Track and monitor your shipments in real-time'}
                    {currentPage === 'invoices' && 'View and manage your invoices'}
                    {currentPage === 'client-users' && 'Manage users in your organization'}
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
    </>
  );
}