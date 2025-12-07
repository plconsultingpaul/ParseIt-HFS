# Fix: Add Conditional Check Step Type Handler to JSON Workflow Processor

**Date:** 2025-12-07
**Issue:** "Unknown step type: conditional_check" error in JSON workflows

## Problem

When executing a workflow with a Conditional Check step on a JSON extraction type, the workflow would fail with the error:

```
Error: Unknown step type: conditional_check
```

The `json-workflow-processor` edge function was missing the handler for the `conditional_check` step type, even though it was already implemented in the `csv-workflow-processor` and `transform-workflow-processor` edge functions.

## Root Cause

The `json-workflow-processor/index.ts` file did not have a case handler for `step.step_type === 'conditional_check'`, causing the workflow to throw an error when encountering this step type.

## Solution

Added the `conditional_check` step type handler to the `json-workflow-processor/index.ts` file. The handler includes:

### Supported Operators

1. **exists** - Checks if value is not null, not undefined, and not empty string
2. **not_exists** / **notExists** - Checks if value is null, undefined, or empty string
3. **equals** / **eq** - String equality comparison
4. **not_equals** / **notEquals** / **ne** - String inequality comparison
5. **contains** - Checks if value contains expected substring
6. **not_contains** / **notContains** - Checks if value does not contain expected substring
7. **greater_than** / **gt** - Numeric comparison (>)
8. **less_than** / **lt** - Numeric comparison (<)
9. **greater_than_or_equal** / **gte** - Numeric comparison (>=)
10. **less_than_or_equal** / **lte** - Numeric comparison (<=)

### Configuration Fields

- `fieldPath` or `checkField` - The JSON path to the field to check
- `operator` - The comparison operator (defaults to "exists")
- `expectedValue` - The value to compare against (for comparison operators)
- `storeResultAs` - Variable name to store the boolean result (defaults to `condition_{step_order}_result`)

### Behavior

1. Extracts the value from the specified field path in the context data
2. Evaluates the condition based on the operator and expected value
3. Stores the boolean result in the context data for use in subsequent workflow steps
4. Logs detailed information about the evaluation process

## Files Modified

### `/supabase/functions/json-workflow-processor/index.ts`

**Location:** Lines 1418-1522 (new conditional_check handler added before the final else block)

**Changes:**
- Added complete `conditional_check` step type handler
- Supports all standard operators for field validation
- Includes comprehensive logging for debugging
- Stores result in context data for use in subsequent steps

## Testing

After deploying this fix to Supabase, workflows with Conditional Check steps on JSON extraction types should:

1. Successfully execute without throwing "Unknown step type" errors
2. Properly evaluate the configured conditions
3. Store the result in the context data
4. Log the evaluation details for troubleshooting

## Example Usage

A Conditional Check step in a JSON workflow might be configured as:

```json
{
  "fieldPath": "orders[0].consignee.clientId",
  "operator": "not_exists",
  "expectedValue": "",
  "storeResultAs": "is_not_null"
}
```

This will check if the consignee client ID exists and store the result as `is_not_null` in the context.

## Deployment Notes

⚠️ **IMPORTANT:** This file must be manually deployed to Supabase using the Supabase CLI or dashboard. The changes are only in the local codebase and need to be pushed to the edge function runtime.

To deploy:
```bash
supabase functions deploy json-workflow-processor
```
