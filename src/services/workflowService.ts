import { supabase } from '../lib/supabase';
import type { ExtractionWorkflow, WorkflowStep } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
  
  // Validate input workflows
  const invalidWorkflows = workflows.filter(w => !w.name || !w.name.trim());
  if (invalidWorkflows.length > 0) {
    console.error('❌ Invalid workflows found (missing name):', invalidWorkflows);
    throw new Error(`${invalidWorkflows.length} workflow(s) have invalid or missing names`);
  }

  const tempToPermIdMap = new Map<string, string>();

  try {
    // Get existing workflows to determine which to update vs insert
    console.log('📋 Fetching existing workflows from database...');
    const { data: existingWorkflows } = await supabase
      .from('extraction_workflows')
      .select('id');

    if (!existingWorkflows) {
      console.warn('⚠️ No existing workflows data returned from database');
    }
    
    const existingIds = new Set((existingWorkflows || []).map(w => w.id));
    console.log('Existing workflow IDs:', Array.from(existingIds));

    const workflowsToUpdate = workflows.filter(workflow => existingIds.has(workflow.id) && !workflow.id.startsWith('temp-'));
    const workflowsToInsert = workflows.filter(workflow => !existingIds.has(workflow.id) || workflow.id.startsWith('temp-'));

    console.log('Workflows to update:', workflowsToUpdate.length);
    console.log('Workflows to insert:', workflowsToInsert.length);
    
    if (workflowsToUpdate.length > 0) {
      console.log('Update candidates:', workflowsToUpdate.map(w => ({ id: w.id, name: w.name })));
    }
    if (workflowsToInsert.length > 0) {
      console.log('Insert candidates:', workflowsToInsert.map(w => ({ id: w.id, name: w.name, isTemp: w.id.startsWith('temp-') })));
    }

    // Update existing workflows
    for (const workflow of workflowsToUpdate) {
      console.log('Updating workflow:', workflow.id, workflow.name);
      
      const updateData = {
        name: workflow.name,
        description: workflow.description,
        is_active: workflow.isActive,
        updated_at: new Date().toISOString()
      };
      
      console.log('Update data for workflow', workflow.id, ':', updateData);
      
      const { data: updateResult, error } = await supabase
        .from('extraction_workflows')
        .update(updateData)
        .eq('id', workflow.id)
        .select('id, name');

      if (error) {
        console.error('❌ Update failed for workflow', workflow.id, ':', error);
        console.error('❌ Update error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('✅ Update result for workflow', workflow.id, ':', updateResult);
      console.log('✅ Updated workflow:', workflow.id);
    }

    // Insert new workflows
    if (workflowsToInsert.length > 0) {
      console.log('Inserting new workflows...');
      
      const insertData = workflowsToInsert.map(workflow => {
        const data = {
          name: workflow.name,
          description: workflow.description,
          is_active: workflow.isActive
        };
        console.log('Insert data for workflow', workflow.name, ':', data);
        return data;
      });
      
      console.log('📝 Executing database insert with data:', insertData);
      
      const { data: insertedWorkflows, error } = await supabase
        .from('extraction_workflows')
        .insert(insertData)
        .select('id, name');

      if (error) {
        console.error('❌ Insert failed:', error);
        console.error('❌ Insert error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        console.error('❌ Failed insert data was:', insertData);
        throw error;
      }

      console.log('✅ Inserted workflows:', insertedWorkflows);
      
      if (!insertedWorkflows || insertedWorkflows.length !== workflowsToInsert.length) {
        console.error('❌ Mismatch in inserted workflows count');
        console.error('Expected:', workflowsToInsert.length);
        console.error('Received:', insertedWorkflows?.length || 0);
        throw new Error('Workflow insertion count mismatch');
      }

      // Create mapping from temp IDs to permanent IDs
      workflowsToInsert.forEach((tempWorkflow, index) => {
        const insertedWorkflow = insertedWorkflows[index];
        if (insertedWorkflow) {
          tempToPermIdMap.set(tempWorkflow.id, insertedWorkflow.id);
          console.log(`Mapped ${tempWorkflow.id} -> ${insertedWorkflow.id}`);
        } else {
          console.error('❌ No inserted workflow found for index', index);
          console.error('❌ Expected workflow:', tempWorkflow);
        }
      });
    }

    // Delete workflows that are no longer in the list
    const currentIds = workflows.filter(workflow => !workflow.id.startsWith('temp-')).map(workflow => workflow.id);
    
    // Add newly inserted permanent IDs to the list of current IDs to protect them from deletion
    tempToPermIdMap.forEach(permId => {
      currentIds.push(permId);
      console.log('✅ Protected newly inserted workflow from cleanup:', permId);
    });
    
    console.log('🛡️ Final protected workflow IDs:', currentIds);
    
    if (currentIds.length > 0) {
      console.log('🗑️ Cleaning up workflows not in current list...');
      
      // First, check what would be deleted
      const { data: workflowsToDelete, error: checkError } = await supabase
        .from('extraction_workflows')
        .select('id, name')
        .not('id', 'in', `(${currentIds.map(id => `"${id}"`).join(',')})`);
      
      if (checkError) {
        console.error('❌ Failed to check workflows for deletion:', checkError);
      } else {
        console.log('🗑️ Workflows that would be deleted:', workflowsToDelete);
        
        // Only proceed with deletion if there are actually workflows to delete
        if (workflowsToDelete && workflowsToDelete.length > 0) {
          console.log(`🗑️ Proceeding to delete ${workflowsToDelete.length} workflows`);
          
          const { data: deletedWorkflows, error } = await supabase
            .from('extraction_workflows')
            .delete()
            .not('id', 'in', `(${currentIds.map(id => `"${id}"`).join(',')})`)
            .select('id, name');

          if (error) {
            console.error('❌ Cleanup failed:', error);
            console.error('❌ Cleanup error details:', {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code
            });
            throw error;
          }
          
          console.log('✅ Successfully deleted workflows:', deletedWorkflows);
        } else {
          console.log('✅ No workflows need to be deleted');
        }
      }
    } else {
      console.log('⚠️ No current workflow IDs to preserve, skipping cleanup entirely');
    }

    console.log('=== updateWorkflows COMPLETE ===');
    console.log('Temp to permanent ID mapping:', Object.fromEntries(tempToPermIdMap));
    return tempToPermIdMap;

  } catch (error) {
    console.error('❌ Error updating workflows:', error);
    console.error('❌ Error type:', error?.constructor?.name);
    console.error('❌ Error message:', error?.message);
    console.error('❌ Error details:', error?.details);
    console.error('❌ Error code:', error?.code);
    console.error('❌ Error stack:', error?.stack);
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
        const stepData = {
          id: step.id.startsWith('temp-') ? uuidv4() : step.id, // Generate UUID for temp steps
          workflow_id: workflowId,
          step_order: step.stepOrder,
          step_type: step.stepType,
          step_name: step.stepName,
          config_json: step.configJson || {},
          next_step_on_success_id: step.nextStepOnSuccessId,
          next_step_on_failure_id: step.nextStepOnFailureId
        };
        
        console.log('Step to insert:', stepData);
        return stepData;
      });

      const { data: insertedSteps, error: insertError } = await supabase
        .from('workflow_steps')
        .insert(stepsToInsert)
        .select('id');

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