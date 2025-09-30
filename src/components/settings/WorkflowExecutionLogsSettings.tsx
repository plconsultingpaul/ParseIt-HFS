import React, { useState } from 'react';
import { GitBranch, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Eye, Calendar, Timer, Play, X, Copy, Database, Check } from 'lucide-react';
import { fetchWorkflowExecutionLogById } from '../../services/logService';
import type { WorkflowExecutionLog, ExtractionWorkflow, WorkflowStep } from '../../types';

interface WorkflowExecutionLogsSettingsProps {
  workflowExecutionLogs: WorkflowExecutionLog[];
  workflows: ExtractionWorkflow[];
  workflowSteps: WorkflowStep[];
  onRefreshWorkflowLogs: () => Promise<WorkflowExecutionLog[]>;
}

export default function WorkflowExecutionLogsSettings({ 
  workflowExecutionLogs, 
  workflows,
  workflowSteps,
  onRefreshWorkflowLogs 
}: WorkflowExecutionLogsSettingsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [loadingContextData, setLoadingContextData] = useState(false);
  const [expandedLogData, setExpandedLogData] = useState<WorkflowExecutionLog | null>(null);

  // Debug logging
  React.useEffect(() => {
    console.log('WorkflowExecutionLogsSettings - Available workflows:', workflows);
    console.log('WorkflowExecutionLogsSettings - Execution logs:', workflowExecutionLogs);
  }, [workflows, workflowExecutionLogs]);

  const handleRefresh = async () => {
    console.log('Refreshing workflow execution logs...');
    setIsRefreshing(true);
    try {
      const logs = await onRefreshWorkflowLogs();
      console.log('Refreshed workflow logs:', logs);
    } catch (error) {
      console.error('Failed to refresh workflow logs:', error);
      alert('Failed to refresh workflow execution logs. Please try again.');
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
      case 'running':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'running':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getWorkflowName = (workflowId: string) => {
    console.log('Looking for workflow with ID:', workflowId);
    console.log('Available workflows:', workflows);
    const workflow = workflows.find(w => w.id === workflowId);
    console.log('Found workflow:', workflow);
    return workflow?.name || `Unknown Workflow (${workflowId.substring(0, 8)}...)`;
  };

  const toggleLogExpansion = async (logId: string) => {
    if (expandedLogId === logId) {
      // Collapsing
      setExpandedLogId(null);
      setExpandedLogData(null);
    } else {
      // Expanding
      setExpandedLogId(logId);
      setLoadingContextData(true);
      
      try {
        const fullLogData = await fetchWorkflowExecutionLogById(logId);
        setExpandedLogData(fullLogData);
      } catch (error) {
        console.error('Error fetching log details:', error);
        alert('Failed to load log details. Please try again.');
      } finally {
        setLoadingContextData(false);
      }
    }
    setCopySuccess(false);
  };

  const getExecutionTime = (log: WorkflowExecutionLog) => {
    if (!log.completedAt) return 'N/A';
    const start = new Date(log.startedAt).getTime();
    const end = new Date(log.completedAt).getTime();
    const duration = end - start;
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
  };

  const handleCopyContextData = async () => {
    if (!expandedLogData?.contextData) return;
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(expandedLogData.contextData, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(expandedLogData.contextData, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Calculate statistics
  const totalExecutions = workflowExecutionLogs.length;
  const completedExecutions = workflowExecutionLogs.filter(log => log.status === 'completed').length;
  const failedExecutions = workflowExecutionLogs.filter(log => log.status === 'failed').length;
  const runningExecutions = workflowExecutionLogs.filter(log => log.status === 'running').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Workflow Execution Logs</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Monitor workflow execution progress and results</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Logs'}</span>
        </button>
      </div>

      {/* Statistics Cards */}
      {totalExecutions > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Play className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Executions</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalExecutions}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</span>
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{completedExecutions}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{failedExecutions}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Running</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{runningExecutions}</p>
          </div>
        </div>
      )}

      {/* Execution Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">Recent Workflow Executions</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {workflowExecutionLogs.length} execution{workflowExecutionLogs.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                  Workflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-64">
                  Current Step
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {workflowExecutionLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(log.status)}`}>
                        {getStatusIcon(log.status)}
                        <span className="ml-1 capitalize">{log.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 w-48">
                      <div className="flex items-center space-x-2">
                        <GitBranch className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-gray-100 truncate" title={getWorkflowName(log.workflowId)}>
                          {getWorkflowName(log.workflowId)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 w-64">
                      <span className="text-sm text-gray-900 dark:text-gray-100 truncate block" title={log.currentStepName || 'N/A'}>
                        {log.currentStepName || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-48">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">{formatDate(log.startedAt)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-24">
                      <div className="flex items-center space-x-2">
                        <Timer className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900 dark:text-gray-100">{getExecutionTime(log)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap w-32">
                      <button
                        onClick={() => toggleLogExpansion(log.id)}
                        className={`text-sm font-medium flex items-center space-x-1 whitespace-nowrap transition-colors duration-200 ${
                          log.errorMessage 
                            ? 'text-red-600 hover:text-red-800' 
                            : 'text-blue-600 hover:text-blue-800'
                        }`}
                      >
                        {expandedLogId === log.id ? (
                          <>
                            <X className="h-4 w-4" />
                            <span>Hide Details</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            <span>View Details</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400 dark:text-gray-500">
                        {log.errorMessage ? 'Click View Details to see error' : '-'}
                      </span>
                    </td>
                  </tr>

                  {expandedLogId === log.id && (
                    <tr>
                      <td colSpan={7} className="px-0 py-0">
                        {loadingContextData ? (
                          <div className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 p-6">
                            <div className="flex items-center justify-center space-x-2">
                              <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                              <span className="text-gray-600 dark:text-gray-400">Loading log details...</span>
                            </div>
                          </div>
                        ) : expandedLogData ? (
                          <div className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
                            <div className="p-6 space-y-6">
                              {/* Execution Summary */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center space-x-2">
                                    <Play className="h-5 w-5 text-purple-600" />
                                    <span>Execution Summary</span>
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(expandedLogData.status)}`}>
                                        {getStatusIcon(expandedLogData.status)}
                                        <span className="ml-1 capitalize">{expandedLogData.status}</span>
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600 dark:text-gray-400">Started:</span>
                                      <span className="text-gray-900 dark:text-gray-100">{formatDate(expandedLogData.startedAt)}</span>
                                    </div>
                                    {expandedLogData.completedAt && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-600 dark:text-gray-400">Completed:</span>
                                        <span className="text-gray-900 dark:text-gray-100">{formatDate(expandedLogData.completedAt)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                                      <span className="text-gray-900 dark:text-gray-100">{getExecutionTime(expandedLogData)}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center space-x-2">
                                    <GitBranch className="h-5 w-5 text-blue-600" />
                                    <span>Current Progress</span>
                                  </h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600 dark:text-gray-400">Current Step:</span>
                                      <span className="text-gray-900 dark:text-gray-100">{expandedLogData.currentStepName || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600 dark:text-gray-400">Workflow:</span>
                                      <span className="text-gray-900 dark:text-gray-100">{getWorkflowName(expandedLogData.workflowId)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Error Message */}
                              {expandedLogData.errorMessage && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <XCircle className="h-5 w-5 text-red-600" />
                                    <h4 className="font-medium text-red-800 dark:text-red-300">Error Details</h4>
                                  </div>
                                  <p className="text-red-700 dark:text-red-400 text-sm whitespace-pre-wrap">{expandedLogData.errorMessage}</p>
                                </div>
                              )}

                              {/* Context Data */}
                              {expandedLogData.contextData && (
                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                                      <Database className="h-5 w-5 text-purple-600" />
                                      <span>Execution Context</span>
                                    </h4>
                                    <button
                                      onClick={handleCopyContextData}
                                      className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center space-x-1 ${
                                        copySuccess 
                                          ? 'bg-green-600 text-white' 
                                          : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
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
                                          <span>Copy Context</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700 max-w-full">
                                    <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono break-words overflow-x-auto">
                                      {JSON.stringify(expandedLogData.contextData, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}

                              {/* Workflow Steps Progress */}
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center space-x-2">
                                  <GitBranch className="h-5 w-5 text-teal-600" />
                                  <span>Workflow Steps</span>
                                </h4>
                                <div className="space-y-2">
                                  {workflowSteps
                                    .filter(step => step.workflowId === expandedLogData.workflowId)
                                    .sort((a, b) => a.stepOrder - b.stepOrder)
                                    .map((step, index) => {
                                      const isCurrentStep = step.id === expandedLogData.currentStepId;
                                      const isCompleted = expandedLogData.status === 'completed' || 
                                        (expandedLogData.currentStepId && workflowSteps.find(s => s.id === expandedLogData.currentStepId)?.stepOrder > step.stepOrder);
                                      const isFailed = expandedLogData.status === 'failed' && isCurrentStep;
                                      
                                      return (
                                        <div
                                          key={step.id}
                                          className={`p-3 rounded-lg border-2 ${
                                            isFailed
                                              ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                                              : isCurrentStep
                                              ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700'
                                              : isCompleted
                                              ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
                                              : 'border-gray-200 bg-gray-50 dark:bg-gray-700 dark:border-gray-600'
                                          }`}
                                        >
                                          <div className="flex items-center space-x-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                              isFailed
                                                ? 'bg-red-200 text-red-800'
                                                : isCurrentStep
                                                ? 'bg-blue-200 text-blue-800'
                                                : isCompleted
                                                ? 'bg-green-200 text-green-800'
                                                : 'bg-gray-200 text-gray-600'
                                            }`}>
                                              {step.stepOrder}
                                            </div>
                                            <div className="flex-1">
                                              <h5 className="font-medium text-gray-900 dark:text-gray-100">{step.stepName}</h5>
                                              <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{step.stepType.replace('_', ' ')}</p>
                                            </div>
                                            <div className="text-right">
                                              {isFailed && <XCircle className="h-5 w-5 text-red-600" />}
                                              {isCurrentStep && expandedLogData.status === 'running' && <Clock className="h-5 w-5 text-blue-600" />}
                                              {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 p-6">
                            <div className="text-center text-gray-600 dark:text-gray-400">
                              Failed to load log details. Please try again.
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        {workflowExecutionLogs.length === 0 && (
          <div className="text-center py-12">
            <GitBranch className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Workflow Executions</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Workflow execution logs will appear here once workflows start running.
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Check for Logs</span>
            </button>
          </div>
        )}
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Workflow Execution Information</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Each workflow execution is logged with detailed progress tracking</li>
          <li>• View step-by-step execution progress and identify where failures occur</li>
          <li>• Context data shows the current state of data at each step</li>
          <li>• Failed executions include detailed error messages for troubleshooting</li>
          <li>• Execution logs are automatically created when workflows are triggered</li>
        </ul>
      </div>
    </div>
  );
}