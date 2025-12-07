# Workflow Rename Immediate Save Fix

## Problem
When clicking the checkmark to save a workflow name change, the update was only saved to local state and not persisted to the database. Users had to click the "Save All" button to persist changes, which was not intuitive.

## Solution
Modified the workflow rename functionality to save immediately to the database when the user clicks the checkmark or presses Enter, matching the behavior of other workflow operations (add/delete).

## Changes Made

### 1. `src/hooks/useWorkflowManagement.ts`
**Changed:** `updateWorkflow` function from synchronous to asynchronous

**Before:**
```typescript
const updateWorkflow = useCallback((workflowId: string, updates: Partial<ExtractionWorkflow>) => {
  const updatedWorkflows = localWorkflows.map(workflow =>
    workflow.id === workflowId ? { ...workflow, ...updates } : workflow
  );
  setLocalWorkflows(updatedWorkflows);
}, [localWorkflows]);
```

**After:**
```typescript
const updateWorkflow = useCallback(async (workflowId: string, updates: Partial<ExtractionWorkflow>) => {
  try {
    // Map field names to database columns
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    // Save to database
    const { error } = await supabase
      .from('extraction_workflows')
      .update(dbUpdates)
      .eq('id', workflowId);

    if (error) throw error;

    // Update local state
    const updatedWorkflows = localWorkflows.map(workflow =>
      workflow.id === workflowId ? { ...workflow, ...updates } : workflow
    );
    setLocalWorkflows(updatedWorkflows);
  } catch (error) {
    console.error('Failed to update workflow:', error);
    throw error;
  }
}, [localWorkflows]);
```

### 2. `src/components/settings/workflow/WorkflowList.tsx`
**Changed:** Updated interface and functions to handle async operations

#### Interface Update:
```typescript
// Changed onUpdateWorkflow to return Promise<void>
onUpdateWorkflow: (workflowId: string, updates: Partial<ExtractionWorkflow>) => Promise<void>;
```

#### handleSaveEdit Function:
**Before:**
```typescript
const handleSaveEdit = (workflowId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  if (editingName.trim()) {
    onUpdateWorkflow(workflowId, { name: editingName.trim() });
  }
  setEditingWorkflowId(null);
  setEditingName('');
};
```

**After:**
```typescript
const handleSaveEdit = async (workflowId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  if (editingName.trim()) {
    try {
      await onUpdateWorkflow(workflowId, { name: editingName.trim() });
      setEditingWorkflowId(null);
      setEditingName('');
    } catch (error) {
      alert('Failed to save workflow name. Please try again.');
    }
  }
};
```

#### handleKeyPress Function:
**Before:**
```typescript
const handleKeyPress = (e: React.KeyboardEvent, workflowId: string) => {
  if (e.key === 'Enter') {
    e.stopPropagation();
    if (editingName.trim()) {
      onUpdateWorkflow(workflowId, { name: editingName.trim() });
    }
    setEditingWorkflowId(null);
    setEditingName('');
  } else if (e.key === 'Escape') {
    // ...
  }
};
```

**After:**
```typescript
const handleKeyPress = async (e: React.KeyboardEvent, workflowId: string) => {
  if (e.key === 'Enter') {
    e.stopPropagation();
    if (editingName.trim()) {
      try {
        await onUpdateWorkflow(workflowId, { name: editingName.trim() });
        setEditingWorkflowId(null);
        setEditingName('');
      } catch (error) {
        alert('Failed to save workflow name. Please try again.');
      }
    }
  } else if (e.key === 'Escape') {
    // ...
  }
};
```

#### Toggle Active/Inactive Button:
**Also updated** the play/pause button to handle async operations with error handling:
```typescript
onClick={async (e) => {
  e.stopPropagation();
  try {
    await onUpdateWorkflow(workflow.id, { isActive: !workflow.isActive });
  } catch (error) {
    alert('Failed to update workflow status. Please try again.');
  }
}}
```

## Benefits
1. ✅ Immediate feedback - changes save instantly
2. ✅ Consistent UX - matches add/delete workflow behavior
3. ✅ No data loss - changes persist immediately
4. ✅ Error handling - users see alerts if save fails
5. ✅ Works with both checkmark click and Enter key

## Testing
To verify the fix:
1. Navigate to Type Setup > Workflows
2. Click the edit icon next to a workflow name
3. Change the name
4. Click the checkmark or press Enter
5. Refresh the page - the new name should persist

## Date
December 7, 2025
