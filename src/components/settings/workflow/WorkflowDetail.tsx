import React, { useState } from 'react';
import { Plus, ArrowUp, ArrowDown, Trash2, Save, Settings } from 'lucide-react';
import type { ExtractionWorkflow, WorkflowStep, ApiConfig } from '../../../types';
import StepConfigForm from './StepConfigForm';

interface WorkflowDetailProps {
  workflow: ExtractionWorkflow;
  steps: WorkflowStep[];
  apiConfig: ApiConfig;
  onUpdateSteps: (steps: WorkflowStep[]) => void;
}

export default function WorkflowDetail({ workflow, steps, apiConfig, onUpdateSteps }: WorkflowDetailProps) {
  const [localSteps, setLocalSteps] = useState<WorkflowStep[]>(steps);
  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update local steps when props change
  React.useEffect(() => {
    setLocalSteps(steps);
  }, [steps]);

  const handleAddStep = () => {
    // Calculate the next available step order
    const maxStepOrder = localSteps.length > 0 ? Math.max(...localSteps.map(s => s.stepOrder)) : 0;
    
    const newStep: WorkflowStep = {
      id: `temp-${Date.now()}`,
      workflowId: workflow.id,
      stepOrder: maxStepOrder + 1,
      stepType: 'api_call',
      stepName: 'New Step',
      configJson: {}
    };
    
    setEditingStep(newStep);
    setShowStepForm(true);
  };

  const handleEditStep = (step: WorkflowStep) => {
    setEditingStep(step);
    setShowStepForm(true);
  };

  const handleSaveStep = (step: WorkflowStep) => {
    console.log('Saving step:', step);
    
    // Ensure configJson is never undefined
    if (!step.configJson) {
      step.configJson = {};
    }
    
    // Check if this is a new step or updating existing
    const existingStepIndex = localSteps.findIndex(s => s.id === step.id);
    let updatedSteps: WorkflowStep[];
    
    if (existingStepIndex >= 0) {
      // Updating existing step
      updatedSteps = localSteps.map(s => s.id === step.id ? step : s);
    } else {
      // Adding new step - assign next available step order
      const maxStepOrder = localSteps.length > 0 ? Math.max(...localSteps.map(s => s.stepOrder)) : 0;
      const stepWithOrder = {
        ...step,
        stepOrder: maxStepOrder + 1
      };
      updatedSteps = [...localSteps, stepWithOrder];
    }
    
    console.log('Updated steps array:', updatedSteps);
    setLocalSteps(updatedSteps);
    
    // Immediately save to database
    handleSaveStepsToDatabase(updatedSteps);
    
    setShowStepForm(false);
    setEditingStep(null);
  };

  const handleDeleteStep = (stepId: string) => {
    if (confirm('Are you sure you want to delete this step?')) {
      const updatedSteps = localSteps.filter(s => s.id !== stepId);
      setLocalSteps(updatedSteps);
      // Immediately save to database
      handleSaveStepsToDatabase(updatedSteps);
    }
  };

  const handleMoveStep = (stepId: string, direction: 'up' | 'down') => {
    const stepIndex = localSteps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return;

    const newIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (newIndex < 0 || newIndex >= localSteps.length) return;

    const updatedSteps = [...localSteps];
    [updatedSteps[stepIndex], updatedSteps[newIndex]] = [updatedSteps[newIndex], updatedSteps[stepIndex]];
    
    setLocalSteps(updatedSteps);
    // Immediately save to database
    handleSaveStepsToDatabase(updatedSteps);
  };

  const handleSaveSteps = async () => {
    await handleSaveStepsToDatabase(localSteps);
  };

  const handleSaveStepsToDatabase = async (stepsToSave: WorkflowStep[]) => {
    setIsSaving(true);
    try {
      console.log('Saving steps to database:', stepsToSave);
      await onUpdateSteps(stepsToSave);
      console.log('Steps saved successfully');
    } catch (error) {
      console.error('Failed to save steps:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to save workflow steps: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getStepTypeIcon = (stepType: string) => {
    switch (stepType) {
      case 'api_call':
        return '🌐';
      case 'conditional_check':
        return '❓';
      case 'data_transform':
        return '🔄';
      default:
        return '⚙️';
    }
  };

  const getStepTypeLabel = (stepType: string) => {
    switch (stepType) {
      case 'api_call':
        return 'API Call';
      case 'conditional_check':
        return 'Conditional Check';
      case 'data_transform':
        return 'Data Transform';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Step Configuration Modal */}
      {showStepForm && editingStep && (
        <StepConfigForm
          step={editingStep}
          allSteps={localSteps}
          apiConfig={apiConfig}
          onSave={handleSaveStep}
          onCancel={() => {
            setShowStepForm(false);
            setEditingStep(null);
          }}
        />
      )}

      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">{workflow.name}</h4>
            <p className="text-sm text-gray-600 mt-1">
              {workflow.description || 'No description provided'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAddStep}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Step</span>
            </button>
            <button
              onClick={handleSaveSteps}
              disabled={isSaving}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save Steps'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="p-6">
        {localSteps.length === 0 ? (
          <div className="text-center py-8">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Steps Defined</h3>
            <p className="text-gray-600 mb-4">Add your first step to get started with this workflow.</p>
            <button
              onClick={handleAddStep}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors duration-200 flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Add First Step</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {localSteps
              .sort((a, b) => a.stepOrder - b.stepOrder)
              .map((step, index) => (
                <div
                  key={step.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition-colors duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-white p-2 rounded-lg border border-gray-300">
                        <span className="text-lg">{getStepTypeIcon(step.stepType)}</span>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full">
                            Step {step.stepOrder}
                          </span>
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                            {getStepTypeLabel(step.stepType)}
                          </span>
                        </div>
                        <h5 className="font-medium text-gray-900 mt-1">{step.stepName}</h5>
                        <p className="text-sm text-gray-600">
                          {step.stepType === 'api_call' && step.configJson.url && `URL: ${step.configJson.url}`}
                          {step.stepType === 'conditional_check' && step.configJson.jsonPath && `Check: ${step.configJson.jsonPath}`}
                          {step.stepType === 'data_transform' && 'Transform data'}
                          {step.stepType === 'sftp_upload' && 'Upload PDF to SFTP'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleMoveStep(step.id, 'up')}
                        disabled={index === 0}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors duration-200"
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveStep(step.id, 'down')}
                        disabled={index === localSteps.length - 1}
                        className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors duration-200"
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditStep(step)}
                        className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors duration-200"
                        title="Edit step"
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors duration-200"
                        title="Delete step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}