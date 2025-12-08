# JSON Workflow OData $filter Query Parameter Escaping Fix

## Date
2025-12-08

## Issue
When variable placeholders (e.g., `{{orders.0.consignee.name}}`) are replaced in `$filter` query parameter values, values containing adjacent parentheses like `AMR-BIG ISLAND (HAWAII)(10100)` cause URL parsing issues. The `)( ` sequence is misinterpreted.

## Root Cause
The variable replacement logic in query parameter processing returned raw string values without escaping the problematic `)(` character sequence for OData `$filter` parameters.

## File Changed
`supabase/functions/json-workflow-processor/index.ts`

## Change Location
Lines 1050-1065 (query parameter variable replacement callback)

## Fix Applied
Added escaping logic to replace `)(` with `)-(` specifically for `$filter` parameter values:

```typescript
paramValue = paramConfig.value.replace(valueVarRegex, (match, doubleBrace, dollarBrace) => {
  const variableName = doubleBrace || dollarBrace;
  const value = getValueByPath(contextData, variableName);
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
  console.warn(`⚠️ Variable ${match} not found in context, leaving unchanged`);
  return match;
});
```

## Result
Values like `(HAWAII)(10100)` are now correctly escaped to `(HAWAII)-(10100)` in `$filter` query parameters, preventing URL parsing issues.

## Deployment
Manual deployment to Supabase required.
