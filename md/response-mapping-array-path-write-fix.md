# Response Data Mapping Array Path Write Fix

**Date:** 2024-12-08

## Problem

When API endpoint steps extracted values from API responses and tried to store them at paths containing array notation (e.g., `orders[0].consignee.clientId`), the values were not being stored correctly.

The code was treating `orders[0]` as a literal property name instead of accessing the first element of the `orders` array. This caused:
- Extracted values to be stored at wrong locations
- Subsequent conditional checks to see `null` instead of the actual value
- Workflow logic to fail because data wasn't where it was expected

## Root Cause

In `json-workflow-processor/index.ts`, the response data mapping write logic used simple dot-splitting:

```javascript
const pathParts = updatePath.split('.');
```

For a path like `orders[0].consignee.clientId`, this produced `['orders[0]', 'consignee', 'clientId']`.

The code then accessed `contextData['orders[0]']` literally, creating a property named `"orders[0]"` instead of navigating to `contextData.orders[0]`.

## Solution

Updated the write logic (lines 823-856) to detect and handle array bracket notation:

1. For each path segment, check if it matches the pattern `name[index]`
2. If it does, access/create the array and navigate to the specific index
3. Handle both intermediate path segments and the final segment

## Files Changed

- `supabase/functions/json-workflow-processor/index.ts` (lines 823-856)

## Testing

After this fix, response data mappings like:
- `clients[0].clientId` -> `orders[0].consignee.clientId`

Will correctly store values at array positions, allowing subsequent conditional checks to find the actual values.
