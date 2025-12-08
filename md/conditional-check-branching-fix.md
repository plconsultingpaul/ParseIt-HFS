# Conditional Check Branching Fix

## Date
2025-12-08

## Issue
When a Conditional Check step evaluated to `false`, the workflow continued to the next sequential step instead of jumping to the configured "Next Step on Failure" target.

Example:
- Step 200 (Check Client ID) evaluated `conditionMet: false`
- Expected: Jump to Step 400 (Create FB) per "Next Step on Failure" config
- Actual: Ran Step 300 (Create Consignee) which was "Next Step on Success"

## Root Cause
The workflow processor in `json-workflow-processor/index.ts` iterated through steps sequentially using a simple `for` loop based on `step_order`. It never read or used the `next_step_on_success_id` or `next_step_on_failure_id` columns from the database, despite:
- The database schema having these columns
- The UI saving these values correctly

## Fix
Added branching logic after conditional check step completion in `supabase/functions/json-workflow-processor/index.ts`:

```typescript
if (step.step_type === 'conditional_check') {
  const conditionResult = stepOutputData?.conditionMet;
  const nextStepId = conditionResult
    ? step.next_step_on_success_id
    : step.next_step_on_failure_id;

  if (nextStepId) {
    const targetIndex = steps.findIndex(s => s.id === nextStepId);
    if (targetIndex !== -1) {
      i = targetIndex - 1; // -1 because loop will increment
    }
  }
}
```

## Behavior After Fix
- `conditionMet: true` -> Jumps to step configured in "Next Step on Success"
- `conditionMet: false` -> Jumps to step configured in "Next Step on Failure"
- If no target step is configured, continues sequentially (backward compatible)

## Files Changed
- `supabase/functions/json-workflow-processor/index.ts` - Added branching logic after conditional check completion (around line 2175)
