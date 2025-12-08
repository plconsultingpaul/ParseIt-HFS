# API Endpoint Response Data Mapping Array Path Fix

## Date
2025-12-08

## Problem
Response data mappings in `api_endpoint` workflow steps were not working when the `updatePath` contained array notation (e.g., `orders[0].consignee.clientId`).

The original code split the path only by `.` which resulted in:
- `orders[0].consignee.clientId` becoming `['orders[0]', 'consignee', 'clientId']`
- The code then tried to access `contextData['orders[0]']` as a literal property name
- This failed because `orders[0]` is not a valid property - it should navigate to the first element of the `orders` array

## Solution
Updated the path parsing in the `api_endpoint` response data mapping handler to:
1. Split paths using regex `/[.\[\]]/` to handle both dot notation and bracket notation
2. Filter out empty strings from the split result
3. Detect when the next path segment is a numeric array index
4. Create arrays (instead of objects) when the next segment is numeric

## File Changed
`supabase/functions/json-workflow-processor/index.ts`

## Code Change (Lines ~1242-1254)

### Before
```javascript
const pathParts = updatePath.split('.');
let current = contextData;
for (let i = 0; i < pathParts.length - 1; i++) {
  const part = pathParts[i];
  if (!current[part]) {
    current[part] = {};
  }
  current = current[part];
}
current[pathParts[pathParts.length - 1]] = extractedValue;
```

### After
```javascript
const pathParts = updatePath.split(/[.\[\]]/).filter(Boolean);
let current = contextData;
for (let i = 0; i < pathParts.length - 1; i++) {
  const part = pathParts[i];
  const nextPart = pathParts[i + 1];
  const isNextPartArrayIndex = /^\d+$/.test(nextPart);
  if (current[part] === undefined || current[part] === null) {
    current[part] = isNextPartArrayIndex ? [] : {};
  }
  current = current[part];
}
const lastPart = pathParts[pathParts.length - 1];
current[lastPart] = extractedValue;
```

## Example
For path `orders[0].consignee.clientId`:
- **Before**: Split to `['orders[0]', 'consignee', 'clientId']` - fails
- **After**: Split to `['orders', '0', 'consignee', 'clientId']` - works correctly

## Deployment
This change is local only. Deploy manually to Supabase using the edge function deployment tool.
