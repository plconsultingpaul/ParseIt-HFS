import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Download, FileText, Loader2, AlertCircle, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { DriverCheckinLog, DriverCheckinDocument } from '../../types';

interface LogWithDocuments extends DriverCheckinLog {
  documents?: DriverCheckinDocument[];
}

export default function DriverCheckinLogsSettings() {
  const [logs, setLogs] = useState<LogWithDocuments[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogWithDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [searchTerm, statusFilter, dateFrom, dateTo, logs]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const { data: logsData, error: logsError } = await supabase
        .from('driver_checkin_logs')
        .select('*')
        .order('check_in_timestamp', { ascending: false });

      if (logsError) throw logsError;

      const logsWithDocuments: LogWithDocuments[] = await Promise.all(
        (logsData || []).map(async (log: any) => {
          const { data: docsData } = await supabase
            .from('driver_checkin_documents')
            .select('*')
            .eq('driver_checkin_log_id', log.id)
            .order('document_order');

          return {
            id: log.id,
            driverCheckinId: log.driver_checkin_id,
            phoneNumber: log.phone_number,
            name: log.name,
            company: log.company,
            bolsCount: log.bols_count,
            doorNumber: log.door_number,
            checkInTimestamp: log.check_in_timestamp,
            status: log.status,
            createdAt: log.created_at,
            documents: (docsData || []).map((doc: any) => ({
              id: doc.id,
              driverCheckinLogId: doc.driver_checkin_log_id,
              pdfFilename: doc.pdf_filename,
              pdfStoragePath: doc.pdf_storage_path,
              documentOrder: doc.document_order,
              extractionTypeId: doc.extraction_type_id,
              workflowId: doc.workflow_id,
              processingStatus: doc.processing_status,
              errorMessage: doc.error_message,
              extractionLogId: doc.extraction_log_id,
              createdAt: doc.created_at
            }))
          };
        })
      );

      setLogs(logsWithDocuments);
    } catch (err) {
      console.error('Error loading logs:', err);
      setError('Failed to load check-in logs');
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.phoneNumber.toLowerCase().includes(term) ||
        log.name.toLowerCase().includes(term) ||
        log.company.toLowerCase().includes(term) ||
        (log.doorNumber?.toString() || 'Not Assigned').includes(term)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(log => log.status === statusFilter);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(log => new Date(log.checkInTimestamp) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => new Date(log.checkInTimestamp) <= toDate);
    }

    setFilteredLogs(filtered);
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const downloadDocument = async (storagePath: string, filename: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('pdfs')
        .download(storagePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading document:', err);
      alert('Failed to download document');
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ['Date/Time', 'Phone', 'Name', 'Company', 'BOLs', 'Door', 'Status', 'Documents'],
      ...filteredLogs.map(log => [
        new Date(log.checkInTimestamp).toLocaleString(),
        log.phoneNumber,
        log.name,
        log.company,
        log.bolsCount,
        log.doorNumber || 'N/A',
        log.status,
        log.documents?.length || 0
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-checkin-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const stats = {
    total: logs.length,
    today: logs.filter(log => {
      const logDate = new Date(log.checkInTimestamp);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }).length,
    completed: logs.filter(log => log.status === 'completed').length,
    failed: logs.filter(log => log.status === 'failed').length,
    avgBols: logs.length > 0 ? (logs.reduce((sum, log) => sum + log.bolsCount, 0) / logs.length).toFixed(1) : 0
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Driver Check-In Logs</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View and track all driver check-in sessions
          </p>
        </div>
        <button
          onClick={exportLogs}
          disabled={filteredLogs.length === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Check-Ins</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Today</div>
          <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed</div>
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Failed</div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg BOLs</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.avgBols}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="flex items-center space-x-2 mb-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-700 dark:text-gray-300">Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search phone, name, company..."
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="scanning">Scanning</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From date"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To date"
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all hover:border-blue-400 dark:hover:border-blue-500"
          />
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredLogs.length} of {logs.length} check-in(s)
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {logs.length === 0 ? 'No check-in logs found' : 'No check-ins match your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => toggleExpand(log.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    {expandedLogId === log.id ? (
                      <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    )}

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-4">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Date/Time</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {new Date(log.checkInTimestamp).toLocaleDateString()}
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(log.checkInTimestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Driver</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.name}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{log.phoneNumber}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Company</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{log.company}</div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">BOLs / Door</div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {log.bolsCount} BOL(s) / Door {log.doorNumber || 'Not Assigned'}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(log.status)}
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {expandedLogId === log.id && log.documents && log.documents.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Documents ({log.documents.length})
                  </h4>
                  <div className="space-y-2">
                    {log.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              BOL #{doc.documentOrder}: {doc.pdfFilename}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(doc.processingStatus)}`}>
                                {doc.processingStatus}
                              </span>
                              {doc.errorMessage && (
                                <span className="text-xs text-red-600 dark:text-red-400" title={doc.errorMessage}>
                                  Error: {doc.errorMessage.substring(0, 50)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadDocument(doc.pdfStoragePath, doc.pdfFilename)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-1 text-sm"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
