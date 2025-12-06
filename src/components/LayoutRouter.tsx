import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, FileText, LogOut, User, HelpCircle, Menu, BarChart3, RefreshCw, Database, Building, Package, ClipboardCheck, Building2, DollarSign, Users as UsersIcon, BookUser, ClipboardList } from 'lucide-react';
import type { User as UserType } from '../types';
import type { CompanyBranding } from '../types';
import DarkModeToggle from './DarkModeToggle';

interface LayoutRouterProps {
  children: React.ReactNode;
  user: UserType;
  companyBranding?: CompanyBranding;
  onLogout: () => void;
}

export default function LayoutRouter({ children, user, companyBranding, onLogout }: LayoutRouterProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const location = useLocation();

  const isSidebarExpanded = !isSidebarCollapsed || isSidebarHovered;

  const navigationItems = React.useMemo(() => [
    {
      id: 'order-entry',
      label: 'Order Entry',
      icon: FileText,
      path: '/order-entry',
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'rate-quote',
      label: 'Rate Quote',
      icon: DollarSign,
      path: '/rate-quote',
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'address-book',
      label: 'Address Book',
      icon: BookUser,
      path: '/address-book',
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'client-users',
      label: 'Users',
      icon: UsersIcon,
      path: '/client-users',
      requiresPermission: true,
      roles: ['client']
    },
    {
      id: 'extract',
      label: 'Extract',
      icon: FileText,
      path: '/extract',
      requiresPermission: false,
      roles: ['admin', 'user']
    },
    {
      id: 'transform',
      label: 'Transform',
      icon: RefreshCw,
      path: '/transform',
      requiresPermission: false,
      roles: ['admin', 'user']
    },
    {
      id: 'types',
      label: 'Type Setup',
      icon: Database,
      path: '/types',
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'vendor-setup',
      label: 'Vendor Setup',
      icon: Package,
      path: '/vendor-setup',
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'client-setup',
      label: 'Client Setup',
      icon: Building2,
      path: '/client-setup',
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'checkin-setup',
      label: 'Check-In Setup',
      icon: ClipboardCheck,
      path: '/checkin-setup',
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: BarChart3,
      path: '/logs',
      requiresPermission: false,
      roles: ['admin', 'user']
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      requiresPermission: true,
      roles: ['admin', 'user']
    },
    {
      id: 'help',
      label: 'Help',
      icon: HelpCircle,
      path: '/help',
      requiresPermission: false,
      roles: ['admin', 'user', 'client', 'vendor']
    }
  ], []);

  const filteredNavigationItems = React.useMemo(() => {
    if (!user || !user.role) {
      return [];
    }

    return navigationItems.filter(item => {
      if (!item.roles.includes(user.role)) {
        return false;
      }

      if (item.id === 'vendor-setup' && !user.permissions.userManagement) {
        return false;
      }

      if (item.id === 'client-setup' && !user.permissions.userManagement) {
        return false;
      }

      if (item.id === 'checkin-setup' && !user.isAdmin) {
        return false;
      }

      if (item.id === 'settings') {
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
          return false;
        }
      }

      if (item.id === 'order-entry' && (!user.hasOrderEntryAccess || user.role !== 'client')) {
        return false;
      }

      if (item.id === 'rate-quote' && (!user.hasRateQuoteAccess || user.role !== 'client')) {
        return false;
      }

      if (item.id === 'address-book' && user.role !== 'client') {
        return false;
      }
      if (item.id === 'address-book' && user.role === 'client' && !user.isClientAdmin && !user.hasAddressBookAccess) {
        return false;
      }

      if (item.id === 'client-users' && (!user.isClientAdmin || user.role !== 'client')) {
        return false;
      }

      return true;
    });
  }, [user, navigationItems]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/extract') return 'Upload & Extract';
    if (path === '/vendor-setup') return 'Vendor Setup';
    if (path === '/checkin-setup') return 'Check-In Setup';
    if (path === '/client-setup') return 'Client Setup';
    if (path === '/transform') return 'Transform & Rename';
    if (path === '/types') return 'Type Setup';
    if (path === '/settings') return 'Settings';
    if (path === '/logs') return 'Activity Logs';
    if (path === '/order-entry') return 'Order Entry';
    if (path.startsWith('/order-entry/submissions')) return 'Order Submissions';
    if (path === '/rate-quote') return 'Rate Quote';
    if (path === '/address-book') return 'Address Book';
    if (path === '/client-users') return 'User Management';
    return 'Parse-It';
  };

  const getPageDescription = () => {
    const path = location.pathname;
    if (path === '/extract') return user.role === 'vendor' ? 'Upload your PDF documents for automated processing' : 'Upload PDFs and extract structured data';
    if (path === '/vendor-setup') return 'Manage vendor accounts and configure orders display settings';
    if (path === '/checkin-setup') return 'Configure driver check-in system and manage driver information';
    if (path === '/client-setup') return 'Manage client companies and their users';
    if (path === '/transform') return 'Extract data from PDFs to intelligently rename files';
    if (path === '/types') return 'Configure extraction types, transformation types, and workflows';
    if (path === '/settings') return 'Configure Parse-It settings and preferences';
    if (path === '/logs') return 'Monitor system activity and processing logs';
    if (path === '/order-entry') return 'Create and manage orders for your organization';
    if (path.startsWith('/order-entry/submissions')) return 'View and manage order submissions';
    if (path === '/rate-quote') return 'Request and manage pricing quotes';
    if (path === '/address-book') return 'Manage customer shipping and receiving addresses';
    if (path === '/client-users') return 'Manage users in your organization';
    return 'PDF Data Extraction';
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <div
        className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out h-full ${
          isSidebarExpanded ? 'w-64' : 'w-16'
        }`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center space-x-3 transition-opacity duration-200 ${
                isSidebarExpanded ? 'opacity-100' : 'opacity-0'
              }`}
            >
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
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-600 bg-clip-text text-transparent">
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
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
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
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group flex items-center ${
                    isActive
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700'
                  }`}
                  title={!isSidebarExpanded ? item.label : undefined}
                >
                  <Icon
                    className={`h-5 w-5 flex-shrink-0 ${
                      isActive
                        ? 'text-purple-600 dark:text-purple-400'
                        : 'text-gray-500 dark:text-gray-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                    }`}
                  />
                  <span
                    className={`font-medium transition-opacity duration-200 ml-3 ${
                      isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Info & Logout */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
          {isSidebarExpanded ? (
            <div className="transition-opacity duration-200 opacity-100">
              <div className="flex items-center space-x-3 mb-3 px-3 py-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                <User className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300 block truncate">
                    {user.username}
                  </span>
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
              <div
                className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg"
                title={`${user.username}${user.isAdmin ? ' (Admin)' : ''}`}
              >
                <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          )}

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
            <span
              className={`font-medium transition-opacity duration-200 ${
                isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'
              }`}
            >
              Sign Out
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4">
                {companyBranding?.logoUrl && (
                  <img
                    src={companyBranding.logoUrl}
                    alt="Company Logo"
                    className="h-10 w-auto max-w-32 object-contain"
                  />
                )}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {getPageTitle()}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">{getPageDescription()}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <DarkModeToggle size="md" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
