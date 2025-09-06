import React, { useState, useMemo } from 'react';
import { ExtractionLog, ExtractionType, User } from '../../types';
import { CheckCircle, XCircle, FileText, User as UserIcon, Calendar, AlertCircle, Copy, Check, X } from 'lucide-react';

interface ExtractionLogsSettingsProps {
  extractionLogs: ExtractionLog[];
  extractionTypes: ExtractionType[];
  users: User[];
  onRefresh: () => void;
  onRefreshWithFilters: (filters: any) => Promise<any>;
}

export default function ExtractionLogsSettings({ 
  extractionLogs, 
  extractionTypes, 
  users, 
  onRefresh,
  onRefreshWithFilters
}: ExtractionLogsSettingsProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<ExtractionLog | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyExtractedSuccess, setCopyExtractedSuccess] = useState(false);
  const [displayedLogs, setDisplayedLogs] = useState<ExtractionLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshLogs = async () => {
    setIsRefreshing(true);
    try {
      // Use the new filtered refresh function
      const filteredLogs = await onRefreshWithFilters({
        statusFilter,
        userFilter,
        typeFilter,
        fromDate,
        toDate
      });
      
      setDisplayedLogs(filteredLogs);
    } catch (error) {
      console.error('Failed to refresh logs:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getUserName = (userId: string | null) => {
    console.log('getUserName called with userId:', userId);
    console.log('Available users:', users);
    if (!userId) return 'Unknown';
    const user = users.find(u => u.id === userId);
    console.log('Found user:', user);
    return user?.username || 'Unknown';
  };

  const getExtractionTypeName = (typeId: string | null) => {
    console.log('getExtractionTypeName called with typeId:', typeId);
    console.log('Available extraction types:', extractionTypes);
    if (!typeId) return 'Unknown';
    const type = extractionTypes.find(t => t.id === typeId);
    console.log('Found extraction type:', type);
    return type?.name || 'Unknown';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleCopyResponse = async () => {
    if (!selectedLog?.api_response) return;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(selectedLog.api_response);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = selectedLog.api_response;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleCopyExtractedData = async () => {
    if (!selectedLog?.extractedData) return;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(selectedLog.extractedData);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = selectedLog.extractedData;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopyExtractedSuccess(true);
      setTimeout(() => setCopyExtractedSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };
  const closeModal = () => {
    setSelectedLog(null);
    setCopySuccess(false);
    setCopyExtractedSuccess(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Extraction Logs</h2>
        <p className="text-gray-600 mt-1">Use the filters below and click "Refresh Logs" to view extraction history</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Filters
          </h3>
          <button
            onClick={handleRefreshLogs}
            disabled={isRefreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
          >
            {isRefreshing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Refreshing...</span>
              </>
            ) : (
              <span>Refresh Logs</span>
            )}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">User</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.username}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Extraction Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {extractionTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PDF Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Extraction Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date/Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {log.extractionStatus === 'success' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="w-4 h-4 mr-1" />
                          Failed
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-900">{log.pdfFilename || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <UserIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-900">{getUserName(log.userId)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{getExtractionTypeName(log.extractionTypeId)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{log.pdfPages || 0}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-900">{formatDate(log.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {log.extractedData && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          View Data
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.errorMessage ? (
                      <span 
                        className="text-sm text-red-600 truncate max-w-xs block cursor-help" 
                        title={log.errorMessage}
                      >
                        {log.errorMessage.length > 50 
                          ? `${log.errorMessage.substring(0, 50)}...` 
                          : log.errorMessage
                        }
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {displayedLogs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              {displayedLogs.length === 0 
                ? "No logs loaded. Use the filters above and click 'Refresh Logs' to view extraction history."
                : "No extraction logs found matching the current filters."
              }
            </p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-indigo-600">
              <div>
                <h3 className="text-lg font-semibold text-white">Extraction Details</h3>
                <p className="text-sm text-purple-100 mt-1">
                  {selectedLog.pdfFilename || 'Unknown PDF'} - {getExtractionTypeName(selectedLog.extractionTypeId)}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {selectedLog.extractedData && (
                  <button
                    onClick={handleCopyExtractedData}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      copyExtractedSuccess 
                        ? 'bg-green-600 text-white' 
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {copyExtractedSuccess ? (
                      <>
                        <Check className="w-4 h-4 inline mr-1" />
                        Copied Data!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 inline mr-1" />
                        Copy Extracted Data
                      </>
                    )}
                  </button>
                )}
                {selectedLog.apiResponse && (
                  <button
                    onClick={handleCopyResponse}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      copySuccess 
                        ? 'bg-green-600 text-white' 
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-4 h-4 inline mr-1" />
                        Copied Response!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 inline mr-1" />
                        Copy API Response
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={closeModal}
                  className="text-white/70 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Extracted Data Section */}
                {selectedLog.extractedData && (
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <FileText className="w-5 h-5 text-green-500" />
                      <h4 className="font-medium text-lg">Extracted Data</h4>
                      <span className="text-sm text-gray-500">
                        (What was extracted from the PDF)
                      </span>
                    </div>
                    <pre className="bg-green-50 p-4 rounded-lg text-sm overflow-x-auto border border-green-200 max-h-64">
                      <code>{selectedLog.extractedData}</code>
                    </pre>
                  </div>
                )}

                {/* API Response Section */}
                {selectedLog.apiResponse && (
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-blue-500" />
                      <h4 className="font-medium text-lg">API Response</h4>
                      <span className="text-sm text-gray-500">
                        Status Code: {selectedLog.apiStatusCode || 'N/A'}
                      </span>
                    </div>
                    <pre className="bg-blue-50 p-4 rounded-lg text-sm overflow-x-auto border border-blue-200 max-h-64">
                      <code>{selectedLog.apiResponse ? JSON.stringify(JSON.parse(selectedLog.apiResponse), null, 2) : 'No response data'}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-900 mb-2">Extraction Logging Information</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• All PDF extraction attempts are automatically logged</li>
          <li>• Logs include both successful extractions and failures</li>
          <li>• API responses are stored for JSON extraction types</li>
          <li>• Use filters to find specific extractions or troubleshoot issues</li>
        </ul>
      </div>
    </div>
  );
}