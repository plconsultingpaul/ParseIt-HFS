import React, { useState } from 'react';
import { FileText, LogOut, User, HelpCircle, Menu, DollarSign, Users as UsersIcon, BookUser, MapPin, Receipt, Building2 } from 'lucide-react';
import type { User as UserType } from '../types';
import type { CompanyBranding } from '../types';
import DarkModeToggle from './DarkModeToggle';

interface ClientLayoutProps {
  children: React.ReactNode;
  currentPage: 'order-entry' | 'rate-quote' | 'address-book' | 'track-trace' | 'invoices' | 'users' | 'help';
  onNavigate: (page: 'order-entry' | 'rate-quote' | 'address-book' | 'track-trace' | 'invoices' | 'users' | 'help') => void;
  user: UserType;
  companyBranding?: CompanyBranding;
  onLogout: () => void;
}

export default function ClientLayout({ children, currentPage, onNavigate, user, companyBranding, onLogout }: ClientLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const isSidebarExpanded = !isSidebarCollapsed || isSidebarHovered;

  const navigationItems = React.useMemo(() => {
    const items: Array<{
      id: 'order-entry' | 'rate-quote' | 'address-book' | 'track-trace' | 'invoices' | 'users' | 'help';
      label: string;
      icon: React.ElementType;
      visible: boolean;
    }> = [
      {
        id: 'track-trace',
        label: 'Track & Trace',
        icon: MapPin,
        visible: user.hasTrackTraceAccess === true
      },
      {
        id: 'invoices',
        label: 'Invoices',
        icon: Receipt,
        visible: user.hasInvoiceAccess === true
      },
      {
        id: 'order-entry',
        label: 'Order Entry',
        icon: FileText,
        visible: user.hasOrderEntryAccess === true
      },
      {
        id: 'rate-quote',
        label: 'Rate Quotes',
        icon: DollarSign,
        visible: user.hasRateQuoteAccess === true
      },
      {
        id: 'address-book',
        label: 'Address Book',
        icon: BookUser,
        visible: user.hasAddressBookAccess === true || user.isClientAdmin === true
      },
      {
        id: 'users',
        label: 'Users',
        icon: UsersIcon,
        visible: user.isClientAdmin === true
      },
      {
        id: 'help',
        label: 'Help',
        icon: HelpCircle,
        visible: true
      }
    ];

    return items.filter(item => item.visible);
  }, [user]);

  const getPageTitle = () => {
    switch (currentPage) {
      case 'order-entry': return 'Order Entry';
      case 'rate-quote': return 'Rate Quotes';
      case 'address-book': return 'Address Book';
      case 'track-trace': return 'Track & Trace';
      case 'invoices': return 'Invoices';
      case 'users': return 'User Management';
      case 'help': return 'Help';
      default: return '';
    }
  };

  const getPageDescription = () => {
    switch (currentPage) {
      case 'order-entry': return 'Create and manage orders for your organization';
      case 'rate-quote': return 'Request and manage pricing quotes';
      case 'address-book': return 'Manage customer shipping and receiving addresses';
      case 'track-trace': return 'Track and monitor your shipments in real-time';
      case 'invoices': return 'View and manage your invoices';
      case 'users': return 'Manage users in your organization';
      case 'help': return 'Get help and support for the client portal';
      default: return '';
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex overflow-hidden transition-colors duration-300">
      <div
        className={`bg-white/90 backdrop-blur-sm border-r border-orange-100 flex flex-col transition-all duration-300 ease-in-out h-full ${
          isSidebarExpanded ? 'w-64' : 'w-16'
        } dark:bg-gray-800/90 dark:border-gray-700`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="p-4 border-b border-orange-100 dark:border-gray-700 flex-shrink-0">
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
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-2 rounded-lg">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">
                  {companyBranding?.showCompanyName && companyBranding?.companyName
                    ? companyBranding.companyName
                    : 'Client Portal'}
                </h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {companyBranding?.showCompanyName && companyBranding?.companyName
                    ? 'Client Portal'
                    : 'Secure Access'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto min-h-0">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                    isActive
                      ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700'
                  }`}
                  title={!isSidebarExpanded ? item.label : undefined}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400 group-hover:text-orange-600 dark:group-hover:text-orange-400'
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

        <div className="p-3 border-t border-orange-100 dark:border-gray-700 flex-shrink-0 bg-white/90 dark:bg-gray-800/90">
          {isSidebarExpanded ? (
            <div className="transition-opacity duration-200 opacity-100">
              <div className="flex items-center space-x-3 mb-3 px-3 py-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                <User className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300 block truncate">{user.username}</span>
                  {user.isClientAdmin && (
                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-200 text-xs font-medium rounded-full">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-lg" title={`${user.username}${user.isClientAdmin ? ' (Admin)' : ''}`}>
                <User className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
            <span className={`font-medium transition-opacity duration-200 ${
              isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0'
            }`}>
              Sign Out
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-blue-100 dark:border-gray-700 p-4 flex-shrink-0">
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
                    {getPageTitle()}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {getPageDescription()}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <DarkModeToggle size="md" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
