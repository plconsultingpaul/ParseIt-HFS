import React, { useState } from 'react';
import { Truck, UserCog } from 'lucide-react';
import type { Workflow } from '../types';
import DriverCheckinSettings from './settings/DriverCheckinSettings';
import DriverManagementSettings from './settings/DriverManagementSettings';

interface CheckInSetupPageProps {
  workflows: Workflow[];
}

type CheckInSetupTab = 'driver-checkin' | 'driver-management';

export default function CheckInSetupPage({ workflows }: CheckInSetupPageProps) {
  const [activeTab, setActiveTab] = useState<CheckInSetupTab>('driver-checkin');

  const tabs = [
    { id: 'driver-checkin' as CheckInSetupTab, label: 'Driver Check-In', icon: Truck, description: 'Configure driver check-in system' },
    { id: 'driver-management' as CheckInSetupTab, label: 'Driver Management', icon: UserCog, description: 'Manage driver information' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'driver-checkin':
        return <DriverCheckinSettings workflows={workflows} />;
      case 'driver-management':
        return <DriverManagementSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
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
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:ring-2 hover:ring-purple-400 dark:hover:ring-purple-500'
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

      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-xl border border-purple-100 dark:border-gray-700 p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
