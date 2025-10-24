import { supabase } from '../lib/supabase';
import type { ExtractionWorkflow, WorkflowStep } from '../types';

export async function fetchWorkflows(): Promise<ExtractionWorkflow[]> {
  try {
    const { data, error } = await supabase
      .from('extraction_workflows')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(workflow => ({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description || '',
      isActive: workflow.is_active,
      createdAt: workflow.created_at,
      updatedAt: workflow.updated_at
    }));
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return [];
  }
}

export async function updateWorkflows(workflows: ExtractionWorkflow[]): Promise<Map<string, string>> {
  console.log('=== updateWorkflows START ===');
  console.log('Input workflows count:', workflows.length);
  console.log('Input workflows:', workflows.map(w => ({ id: w.id, name: w.name, isTemp: w.id.startsWith('temp-') })));

  const tempToPermIdMap = new Map<string, string>();

  try {
    // Get existing workflows to determine which to update vs insert
    const { data: existingWorkflows } = await supabase
      .from('extraction_workflows')
      .select('id');

    const existingIds = new Set((existingWorkflows || []).map(w => w.id));
    console.log('Existing workflow IDs:', Array.from(existingIds));

    const workflowsToUpdate = workflows.filter(workflow => existingIds.has(workflow.id) && !workflow.id.startsWith('temp-'));
    const workflowsToInsert = workflows.filter(workflow => !existingIds.has(workflow.id) || workflow.id.startsWith('temp-'));

    console.log('Workflows to update:', workflowsToUpdate.length);
    console.log('Workflows to insert:', workflowsToInsert.length);

    // Update existing workflows
    for (const workflow of workflowsToUpdate) {
      console.log('Updating workflow:', workflow.id, workflow.name);
      const { error } = await supabase
        .from('extraction_workflows')
        .update({
          name: workflow.name,
          description: workflow.description,
          is_active: workflow.isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflow.id);

      if (error) throw error;
      console.log('✅ Updated workflow:', workflow.id);
    }

    // Insert new workflows
    if (workflowsToInsert.length > 0) {
      console.log('Inserting new workflows...');
      const { data: insertedWorkflows, error } = await supabase
        .from('extraction_workflows')
        .insert(
          workflowsToInsert.map(workflow => ({
            name: workflow.name,
            description: workflow.description,
            is_active: workflow.isActive
          }))
        )
        .select('id, name');

      if (error) throw error;

      console.log('✅ Inserted workflows:', insertedWorkflows);

      // Create mapping from temp IDs to permanent IDs
      workflowsToInsert.forEach((tempWorkflow, index) => {
        const insertedWorkflow = insertedWorkflows[index];
        if (insertedWorkflow) {
          tempToPermIdMap.set(tempWorkflow.id, insertedWorkflow.id);
          console.log(`Mapped ${tempWorkflow.id} -> ${insertedWorkflow.id}`);
        }
      });
    }

    // Delete workflows that are no longer in the list
    const currentIds = workflows.filter(workflow => !workflow.id.startsWith('temp-')).map(workflow => workflow.id);
    // Add newly inserted permanent IDs to the list of current IDs
    tempToPermIdMap.forEach(permId => currentIds.push(permId));
    
    if (currentIds.length > 0) {
      console.log('Current workflow IDs (including new ones):', currentIds);
      const { error } = await supabase
        .from('extraction_workflows')
        .delete()
        .filter('id', 'not.in', `(${currentIds.map(id => `"${id}"`).join(',')})`);

      if (error) throw error;
      console.log('✅ Cleaned up old workflows');
    }

    console.log('=== updateWorkflows COMPLETE ===');
    console.log('Temp to permanent ID mapping:', Object.fromEntries(tempToPermIdMap));
    return tempToPermIdMap;

  } catch (error) {
    console.error('❌ Error updating workflows:', error);
    throw error;
  }
}

export async function deleteWorkflow(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('extraction_workflows')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting workflow:', error);
    throw error;
  }
}

export async function fetchWorkflowSteps(): Promise<WorkflowStep[]> {
  try {
    const { data, error } = await supabase
      .from('workflow_steps')
      .select('*')
      .order('workflow_id, step_order');

    if (error) throw error;

    return (data || []).map(step => ({
      id: step.id,
      workflowId: step.workflow_id,
      stepOrder: step.step_order,
      stepType: step.step_type,
      stepName: step.step_name,
      configJson: step.config_json || {},
      nextStepOnSuccessId: step.next_step_on_success_id,
      nextStepOnFailureId: step.next_step_on_failure_id,
      createdAt: step.created_at,
      updatedAt: step.updated_at
    }));
  } catch (error) {
    console.error('Error fetching workflow steps:', error);
    return [];
  }
}

export async function updateWorkflowSteps(workflowId: string, steps: WorkflowStep[]): Promise<void> {
  console.log('=== updateWorkflowSteps START ===');
  console.log('Workflow ID:', workflowId);
  console.log('Steps to save:', steps.length);
  console.log('Steps details:', steps.map(s => ({ id: s.id, name: s.stepName, order: s.stepOrder, type: s.stepType })));

  try {
    // First, delete all existing steps for this workflow
    console.log('🗑️ Deleting existing steps for workflow:', workflowId);
    const { error: deleteError } = await supabase
      .from('workflow_steps')
      .delete()
      .eq('workflow_id', workflowId);

    if (deleteError) throw deleteError;
    console.log('✅ Existing steps deleted');

    // Then insert the new steps if any
    if (steps.length > 0) {
      console.log('📝 Inserting new steps...');

      const stepsToInsert = steps.map(step => {
        // Build the step data object, completely omitting 'id' for temp steps
        // This allows the database to use its DEFAULT gen_random_uuid() for new steps
        const stepData: any = {
          workflow_id: workflowId,
          step_order: step.stepOrder,
          step_type: step.stepType,
          step_name: step.stepName,
          config_json: step.configJson || {},
          next_step_on_success_id: step.nextStepOnSuccessId || null,
          next_step_on_failure_id: step.nextStepOnFailureId || null
        };

        // Only include the id field if it's not a temporary ID
        if (step.id && !step.id.toString().startsWith('temp-')) {
          stepData.id = step.id;
        }

        console.log('Step to insert:', stepData);
        return stepData;
      });

      // Insert steps - let database generate IDs for new steps
      const { data: insertedSteps, error: insertError } = await supabase
        .from('workflow_steps')
        .insert(stepsToInsert)
        .select();

      if (insertError) throw insertError;
      console.log('✅ Steps inserted successfully:', insertedSteps);
    }

    console.log('=== updateWorkflowSteps COMPLETE ===');
  } catch (error) {
    console.error('❌ Error updating workflow steps:', error);
    throw error;
  }
}

export async function deleteWorkflowStep(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('workflow_steps')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting workflow step:', error);
    throw error;
  }
}