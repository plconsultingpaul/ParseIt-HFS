# OData Parentheses Separator Fix - All Workflow Processors

## Date
2025-12-08

## Problem
OData `$filter` query parameter values containing adjacent closing and opening parentheses `)(` were being misinterpreted by the API as function call separators, causing query parsing errors.

Example: `contains(name,'value')(otherCondition)` was being parsed incorrectly.

## Solution
Added targeted escaping logic to replace `)(` with `)-(` specifically in `$filter` parameter values during variable replacement. This prevents the API from misinterpreting the parentheses sequence as a function separator.

## Files Modified

### supabase/functions/csv-workflow-processor/index.ts
- Location: Query parameter variable replacement callback (around line 892-896)
- Added `isODataFilterParam` check for `$filter` parameter
- Added `)(` to `)-(` replacement when detected in filter values

### supabase/functions/transform-workflow-processor/index.ts
- Location: Query parameter variable replacement callback (around line 1043-1047)
- Added identical escaping logic for `$filter` parameter values

### supabase/functions/json-workflow-processor/index.ts
- Previously fixed with same logic (around line 1050-1061)

## Code Change
```typescript
// Before
if (value !== undefined && value !== null) {
  console.log(`🔄 Replaced query param variable ${match} with:`, value);
  return String(value);
}

// After
if (value !== undefined && value !== null) {
  let rawValue = String(value);
  const isODataFilterParam = paramName.toLowerCase() === '$filter';
  if (isODataFilterParam && rawValue.includes(')(')) {
    rawValue = rawValue.replace(/\)\(/g, ')-(');
    console.log(`🔧 Escaped )( to )-( in $filter param value:`, rawValue);
  }
  console.log(`🔄 Replaced query param variable ${match} with:`, rawValue);
  return rawValue;
}
```

## Impact
- Only affects `$filter` query parameters
- Only triggers when `)(` sequence is present in the value
- Minimal performance impact (simple string check and replace)
- Consistent behavior across all three workflow processors
