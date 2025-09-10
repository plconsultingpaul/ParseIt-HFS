import React, { useState } from 'react';
import { GitBranch, Plus, Save } from 'lucide-react';
import { useSupabaseData } from '../../hooks/useSupabaseData';
import WorkflowList from './workflow/WorkflowList';
import WorkflowDetail from './workflow/WorkflowDetail';
import type { ExtractionWorkflow, WorkflowStep } from '../../types';
import type { ApiConfig } from '../../types';

interface WorkflowSettingsProps {
  apiConfig: ApiConfig;
}

export default function WorkflowSettings({ apiConfig }: WorkflowSettingsProps) {
  const { workflows, workflowSteps, updateWorkflows, updateWorkflowSteps } = useSupabaseData();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [localWorkflows, setLocalWorkflows] = useState<ExtractionWorkflow[]>(workflows);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Update local state when workflows change
  React.useEffect(() => {
    setLocalWorkflows(workflows);
  }, [workflows]);

  const selectedWorkflow = localWorkflows.find(w => w.id === selectedWorkflowId);
  const selectedWorkflowSteps = workflowSteps.filter(s => s.workflowId === selectedWorkflowId);

  const handleAddWorkflow = () => {
    const newWorkflow: ExtractionWorkflow = {
      id: `temp-${Date.now()}`,
      name: 'New Workflow',
      description: '',
      isActive: true
    };
    
    const updatedWorkflows = [...localWorkflows, newWorkflow];
    setLocalWorkflows(updatedWorkflows);
    setSelectedWorkflowId(newWorkflow.id);
  };

  const handleUpdateWorkflow = (workflowId: string, updates: Partial<ExtractionWorkflow>) => {
    setLocalWorkflows(prev => 
      prev.map(workflow => 
        workflow.id === workflowId 
          ? { ...workflow, ...updates }
          : workflow
      )
    );
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    setLocalWorkflows(prev => prev.filter(w => w.id !== workflowId));
    if (selectedWorkflowId === workflowId) {
      setSelectedWorkflowId(null);
    }
  };

  const handleUpdateWorkflowSteps = async (workflowId: string, steps: WorkflowStep[]) => {
    try {
      await updateWorkflowSteps(workflowId, steps);
    } catch (error) {
      console.error('Failed to update workflow steps:', error);
      alert('Failed to save workflow steps. Please try again.');
    }
  };

  const handleSaveWorkflows = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await updateWorkflows(localWorkflows);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save workflows:', error);
      alert('Failed to save workflows. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Workflow Management</h3>
          <p className="text-gray-600 mt-1">Create and manage multi-step extraction workflows</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddWorkflow}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Workflow</span>
          </button>
          <button
            onClick={handleSaveWorkflows}
            disabled={isSaving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Saving...' : 'Save All'}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="font-semibold text-green-800">Success!</span>
          </div>
          <p className="text-green-700 text-sm mt-1">Workflows saved successfully!</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workflow List */}
        <div className="lg:col-span-1">
          <WorkflowList
            workflows={localWorkflows}
            selectedWorkflowId={selectedWorkflowId}
            onSelectWorkflow={setSelectedWorkflowId}
            onUpdateWorkflow={handleUpdateWorkflow}
            onDeleteWorkflow={handleDeleteWorkflow}
          />
        </div>

        {/* Workflow Detail */}
        <div className="lg:col-span-2">
          {selectedWorkflow ? (
            <WorkflowDetail
              workflow={selectedWorkflow}
              steps={selectedWorkflowSteps}
              apiConfig={apiConfig}
              onUpdateSteps={(steps) => handleUpdateWorkflowSteps(selectedWorkflow.id, steps)}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
              <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Workflow Selected</h3>
              <p className="text-gray-600">Select a workflow from the list to view and edit its steps.</p>
            </div>
          )}
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Workflow System Information</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Workflows define multi-step processes for handling extracted data</li>
          <li>• Steps are executed in order and can include API calls, conditional checks, and data transformations</li>
          <li>• Each extraction type can be linked to a specific workflow</li>
          <li>• Workflow execution progress is tracked and can be monitored in real-time</li>
          <li>• Failed steps will halt workflow execution and provide detailed error information</li>
        </ul>
      </div>
    </div>
  );
}