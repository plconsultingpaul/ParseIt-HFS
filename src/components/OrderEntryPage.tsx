import React from 'react';
import { FileText, Info } from 'lucide-react';

export default function OrderEntryPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-xl border border-teal-100 dark:border-gray-700 p-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="bg-teal-100 dark:bg-teal-900/50 p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <FileText className="h-10 w-10 text-teal-600 dark:text-teal-400" />
          </div>

          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Order Entry
          </h2>

          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Order entry functionality will be implemented here. This page will allow you to create, manage, and track orders for your organization.
          </p>

          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-lg p-6 text-left">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-teal-900 dark:text-teal-300 mb-2">
                  Planned Features
                </h3>
                <ul className="text-sm text-teal-700 dark:text-teal-400 space-y-1">
                  <li>• Create and submit new orders</li>
                  <li>• View order history and status</li>
                  <li>• Track order fulfillment</li>
                  <li>• Export order data</li>
                  <li>• Manage order details and specifications</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
