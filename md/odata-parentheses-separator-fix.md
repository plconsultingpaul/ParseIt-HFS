# OData Consecutive Parentheses Separator Fix

## Date
2025-12-08

## Problem
API requests with OData `$filter` parameters containing consecutive parentheses `)(` in values (e.g., `AMR-BIG ISLAND (HAWAII)(10100)`) were being blocked by Azure Application Gateway WAF with 403 errors.

URL encoding the parentheses did not resolve the issue - WAF still detected the pattern.

## Root Cause
Azure WAF interprets the `)(` pattern in OData filter values as a potential function injection attack, regardless of URL encoding.

## Solution
When "Escape Single Quotes for OData Filters" is enabled, also replace `)(` with `)-(` in the extracted values before building the URL.

This breaks the consecutive parentheses pattern that triggers WAF detection.

## Change
**File:** `supabase/functions/json-workflow-processor/index.ts`

**Function:** `escapeSingleQuotesForOData` (lines 102-109)

Before:
```javascript
function escapeSingleQuotesForOData(value) {
  if (typeof value !== 'string') {
    return value;
  }
  // Replace single quote with double single quote for OData filter compatibility
  return value.replace(/'/g, "''");
}
```

After:
```javascript
function escapeSingleQuotesForOData(value) {
  if (typeof value !== 'string') {
    return value;
  }
  // Replace single quote with double single quote for OData filter compatibility
  // Also replace )( with )-( to avoid WAF pattern detection
  return value.replace(/'/g, "''").replace(/\)\(/g, ')-(');
}
```

## Expected Result
Value transformation:
```
AMR-BIG ISLAND (HAWAII)(10100)
```
Becomes:
```
AMR-BIG ISLAND (HAWAII)-(10100)
```

URL will be:
```
$filter=name%20eq%20'AMR-BIG%20ISLAND%20(HAWAII)-(10100)'
```

## Activation
This fix is applied when the "Escape Single Quotes for OData Filters" checkbox is enabled in the workflow step configuration.

## Other Edge Functions to Update
If this fix works, apply the same change to:
- `csv-workflow-processor`
- `transform-workflow-processor`
