import React from 'react';
import { Settings, FileText, Lock, Mail, LogOut, User } from 'lucide-react';
import type { User as UserType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: 'extract' | 'settings';
  onNavigate: (page: 'extract' | 'settings') => void;
  user: UserType;
  onLogout: () => void;
}

export default function Layout({ children, currentPage, onNavigate, user, onLogout }: LayoutProps) {
  const handleSettingsClick = () => {
    const hasAnyPermission = Object.values(user.permissions).some(permission => permission === true);
    
    if (!hasAnyPermission) {
      alert('You do not have permission to access settings. Contact your administrator to request access.');
      return;
    }
    onNavigate('settings');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  ParseIt
                </h1>
                <p className="text-sm text-gray-600">
                  Upload a PDF, provide extraction instructions, and get a structured XML file in seconds.
                </p>
              </div>
            </div>
            
            <nav className="flex items-center space-x-2">
              {/* User Info */}
              <div className="flex items-center space-x-3 mr-4">
                <div className="flex items-center space-x-2 px-3 py-2 bg-purple-50 rounded-lg">
                  <User className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">{user.username}</span>
                  {user.isAdmin && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                      Admin
                    </span>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => onNavigate('extract')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  currentPage === 'extract'
                    ? 'bg-purple-100 text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                Extract
              </button>
              
              {user.isAdmin && (
              <button
                onClick={handleSettingsClick}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  currentPage === 'settings'
                    ? 'bg-purple-100 text-purple-700 shadow-sm'
                    : 'text-gray-600 hover:text-purple-600 hover:bg-purple-50'
                }`}
              >
                <Settings className="h-5 w-5" />
              </button>
              )}
              
              <button
                onClick={onLogout}
                className="p-2 rounded-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}