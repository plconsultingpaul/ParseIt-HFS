import React, { useState, useMemo } from 'react';
import { ExtractionLog, ExtractionType, TransformationType, User } from '../../types';
import { CheckCircle, XCircle, FileText, User as UserIcon, Calendar, AlertCircle, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

interface ExtractionLogsSettingsProps {
  extractionLogs: ExtractionLog[];
  extractionTypes: ExtractionType[];
  transformationTypes: TransformationType[];
  users: User[];
  onRefresh: () => void;
  onRefreshWithFilters: (filters: any) => Promise<any>;
}

export default function ExtractionLogsSettings({ 
  extractionLogs = [], 
  extractionTypes = [], 
  transformationTypes = [],
  users = [], 
  onRefresh,
  onRefreshWithFilters
}: ExtractionLogsSettingsProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [processingModeFilter, setProcessingModeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
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
        processingModeFilter,
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
    if (!userId) return 'Email';
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

  const getTransformationTypeName = (typeId: string | null) => {
    if (!typeId) return 'Unknown';
    const type = transformationTypes.find(t => t.id === typeId);
    return type?.name || 'Unknown';
  };

  const getProcessingTypeName = (log: ExtractionLog) => {
    if (log.processingMode === 'transformation') {
      return getTransformationTypeName(log.transformationTypeId);
    } else {
      return getExtractionTypeName(log.extractionTypeId);
    }
  };
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleCopyResponse = async () => {
    const log = displayedLogs.find(l => l.id === expandedLogId);
    if (!log?.apiResponse) return;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(log.apiResponse);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = log.apiResponse;
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
    const log = displayedLogs.find(l => l.id === expandedLogId);
    if (!log?.extractedData) return;
    
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(log.extractedData);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = log.extractedData;
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

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
    setCopySuccess(false);
    setCopyExtractedSuccess(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Processing Logs</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Use the filters below and click "Refresh Logs" to view extraction and transformation history</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">User</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
            >
              <option value="all">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.username}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Processing Mode</label>
            <select
              value={processingModeFilter}
              onChange={(e) => setProcessingModeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
            >
              <option value="all">All Modes</option>
              <option value="extraction">Extraction</option>
              <option value="transformation">Transformation</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
            >
              <option value="all">All Types</option>
              <optgroup label="Extraction Types">
                {extractionTypes.map(type => (
                  <option key={`extraction-${type.id}`} value={`extraction-${type.id}`}>{type.name}</option>
                ))}
              </optgroup>
              <optgroup label="Transformation Types">
                {transformationTypes.map(type => (
                  <option key={`transformation-${type.id}`} value={`transformation-${type.id}`}>{type.name}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  PDF Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Mode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date/Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {displayedLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                      <span className="text-sm text-gray-900 dark:text-gray-100">{log.pdfFilename || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <UserIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{getUserName(log.userId)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      log.processingMode === 'transformation' 
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                    }`}>
                      {log.processingMode === 'transformation' ? 'Transform' : 'Extract'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{getProcessingTypeName(log)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{log.pdfPages || 0}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(log.createdAt)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {log.extractedData && (
                        <button
                          onClick={() => toggleLogExpansion(log.id)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center space-x-1"
                        >
                          {expandedLogId === log.id ? (
                            <>
                              <ChevronUp className="h-4 w-4" />
                              <span>Hide Data</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              <span>View Data</span>
                            </>
                          )}
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
                      <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                  </tr>
                
                {expandedLogId === log.id && (
                  <tr>
                    <td colSpan={9} className="px-0 py-0">
                      <div className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                        <div className="p-6 space-y-6">
                          {/* Extracted Data Section */}
                          {log.extractedData && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <FileText className="w-5 h-5 text-green-500" />
                                  <h4 className="font-medium text-lg text-gray-900 dark:text-gray-100">
                                    {log.processingMode === 'transformation' ? 'Transformation Data' : 'Extracted Data'}
                                  </h4>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    ({log.processingMode === 'transformation' ? 'Data extracted for renaming' : 'What was extracted from the PDF'})
                                  </span>
                                </div>
                                <button
                                  onClick={handleCopyExtractedData}
                                  className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center space-x-1 ${
                                    copyExtractedSuccess 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                                  }`}
                                >
                                  {copyExtractedSuccess ? (
                                    <>
                                      <Check className="w-4 h-4" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4" />
                                      <span>Copy Data</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700 max-w-full">
                                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono break-words overflow-x-auto">
                                  {log.extractedData}
                                </pre>
                              </div>
                            </div>
                          )}

                          {/* API Response Section */}
                          {log.apiResponse && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                  <CheckCircle className="w-5 h-5 text-blue-500" />
                                  <h4 className="font-medium text-lg text-gray-900 dark:text-gray-100">API Response</h4>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Status Code: {log.apiStatusCode || 'N/A'}
                                  </span>
                                </div>
                                <button
                                  onClick={handleCopyResponse}
                                  className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center space-x-1 ${
                                    copySuccess 
                                      ? 'bg-green-600 text-white' 
                                      : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                                  }`}
                                >
                                  {copySuccess ? (
                                    <>
                                      <Check className="w-4 h-4" />
                                      <span>Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4" />
                                      <span>Copy Response</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700 max-w-full">
                                <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono break-words overflow-x-auto">
                                  {log.apiResponse ? JSON.stringify(JSON.parse(log.apiResponse), null, 2) : 'No response data'}
                                </pre>
                              </div>
                            </div>
                          )}

                          {/* Error Details Section */}
                          {log.errorMessage && (
                            <div>
                              <div className="flex items-center space-x-2 mb-3">
                                <XCircle className="w-5 h-5 text-red-500" />
                                <h4 className="font-medium text-lg text-gray-900 dark:text-gray-100">Error Details</h4>
                              </div>
                              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
                                <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">
                                  {log.errorMessage}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* API Error Details Section */}
                          {log.apiError && (
                            <div>
                              <div className="flex items-center space-x-2 mb-3">
                                <XCircle className="w-5 h-5 text-red-500" />
                                <h4 className="font-medium text-lg text-gray-900 dark:text-gray-100">API Error Details</h4>
                              </div>
                              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
                                <pre className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap font-mono overflow-x-auto">
                                  {log.apiError}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        {displayedLogs.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              {displayedLogs.length === 0 
                ? "No logs loaded. Use the filters above and click 'Refresh Logs' to view processing history."
                : "No processing logs found matching the current filters."
              }
            </p>
          </div>
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-900 dark:text-blue-300 mb-2">Processing Logging Information</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
          <li>• All PDF processing attempts (extraction and transformation) are automatically logged</li>
          <li>• Logs include both successful operations and failures</li>
          <li>• API responses are stored for JSON extraction types</li>
          <li>• Use filters to find specific operations or troubleshoot issues</li>
          <li>• Processing Mode filter helps distinguish between data extraction and PDF transformation/renaming</li>
        </ul>
      </div>
    </div>
  );
}