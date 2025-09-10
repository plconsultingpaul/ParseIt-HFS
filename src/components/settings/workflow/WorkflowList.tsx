import React from 'react';
import { GitBranch, Trash2, Play, Pause } from 'lucide-react';
import type { ExtractionWorkflow } from '../../../types';

interface WorkflowListProps {
  workflows: ExtractionWorkflow[];
  selectedWorkflowId: string | null;
  onSelectWorkflow: (workflowId: string) => void;
  onUpdateWorkflow: (workflowId: string, updates: Partial<ExtractionWorkflow>) => void;
  onDeleteWorkflow: (workflowId: string) => void;
}

export default function WorkflowList({
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  onUpdateWorkflow,
  onDeleteWorkflow
}: WorkflowListProps) {
  const handleDeleteWorkflow = (workflowId: string, workflowName: string) => {
    if (confirm(`Are you sure you want to delete the workflow "${workflowName}"? This action cannot be undone.`)) {
      onDeleteWorkflow(workflowId);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <h4 className="font-semibold text-gray-900">Workflows</h4>
        <p className="text-sm text-gray-600 mt-1">{workflows.length} workflow{workflows.length !== 1 ? 's' : ''}</p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {workflows.map((workflow) => (
          <div
            key={workflow.id}
            className={`p-4 cursor-pointer transition-colors duration-200 ${
              selectedWorkflowId === workflow.id
                ? 'bg-purple-50 border-r-4 border-purple-500'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelectWorkflow(workflow.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <div className={`p-2 rounded-lg ${
                  workflow.isActive ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <GitBranch className={`h-4 w-4 ${
                    workflow.isActive ? 'text-green-600' : 'text-gray-500'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={workflow.name}
                    onChange={(e) => onUpdateWorkflow(workflow.id, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="font-medium text-gray-900 bg-transparent border-none p-0 focus:outline-none focus:ring-0 w-full"
                  />
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {workflow.description || 'No description'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-1 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateWorkflow(workflow.id, { isActive: !workflow.isActive });
                  }}
                  className={`p-1 rounded transition-colors duration-200 ${
                    workflow.isActive
                      ? 'text-green-600 hover:bg-green-100'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={workflow.isActive ? 'Disable workflow' : 'Enable workflow'}
                >
                  {workflow.isActive ? (
                    <Play className="h-3 w-3" />
                  ) : (
                    <Pause className="h-3 w-3" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteWorkflow(workflow.id, workflow.name);
                  }}
                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                  title="Delete workflow"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {workflows.length === 0 && (
          <div className="p-8 text-center">
            <GitBranch className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No workflows created yet</p>
          </div>
        )}
      </div>
    </div>
  );
}