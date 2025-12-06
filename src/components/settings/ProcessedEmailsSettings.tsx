import React from 'react';
import { Mail, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import type { ProcessedEmail } from '../../types';

interface ProcessedEmailsSettingsProps {
  processedEmails: ProcessedEmail[];
  onRefresh?: () => Promise<void>;
}

export default function ProcessedEmailsSettings({ processedEmails, onRefresh }: ProcessedEmailsSettingsProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh processed emails:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'processing':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Processed Emails</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">View recently processed emails and their status</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Emails'}</span>
        </button>
      </div>

      {processedEmails.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Processed Emails</h3>
          <p className="text-gray-600 dark:text-gray-400">Processed emails will appear here once email monitoring is active.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {processedEmails.map((email) => (
            <div key={email.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <Mail className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {email.subject}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      From: {email.sender}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Received: {new Date(email.receivedDate).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full border text-xs font-medium flex items-center space-x-1 ${getStatusColor(email.processingStatus)}`}>
                  {getStatusIcon(email.processingStatus)}
                  <span className="capitalize">{email.processingStatus}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {email.pdfFilename && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">PDF File:</span>
                    <p className="text-gray-600 dark:text-gray-400">{email.pdfFilename}</p>
                  </div>
                )}
                {email.parseitId && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Parse-It ID:</span>
                    <p className="text-gray-600 dark:text-gray-400">{email.parseitId}</p>
                  </div>
                )}
                {email.processedAt && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Processed:</span>
                    <p className="text-gray-600 dark:text-gray-400">{new Date(email.processedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {email.errorMessage && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-800 dark:text-red-300">Error</span>
                  </div>
                  <p className="text-red-700 dark:text-red-400 text-sm">{email.errorMessage}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Statistics */}
      {processedEmails.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Processing Statistics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-700 dark:text-blue-400">Total:</span>
              <p className="text-blue-600 dark:text-blue-300">{processedEmails.length}</p>
            </div>
            <div>
              <span className="font-medium text-blue-700 dark:text-blue-400">Completed:</span>
              <p className="text-blue-600 dark:text-blue-300">
                {processedEmails.filter(e => e.processingStatus === 'completed').length}
              </p>
            </div>
            <div>
              <span className="font-medium text-blue-700 dark:text-blue-400">Failed:</span>
              <p className="text-blue-600 dark:text-blue-300">
                {processedEmails.filter(e => e.processingStatus === 'failed').length}
              </p>
            </div>
            <div>
              <span className="font-medium text-blue-700 dark:text-blue-400">Processing:</span>
              <p className="text-blue-600 dark:text-blue-300">
                {processedEmails.filter(e => e.processingStatus === 'processing').length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}