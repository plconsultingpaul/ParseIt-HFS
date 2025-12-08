# OData Parentheses Hybrid Encoding Fix

## Date
2025-12-08

## Problem
API requests with OData `$filter` parameters containing parentheses in values (e.g., `AMR-BIG ISLAND (HAWAII)(10100)`) were being blocked by Azure Application Gateway WAF with 403 errors.

Previous fix attempted to leave parentheses unencoded, but WAF still blocked requests based on content pattern detection.

## Root Cause
Azure WAF interprets OData filter patterns like `name eq 'value(something)'` as potential SQL injection attacks, regardless of whether parentheses are URL-encoded or not.

## Solution
Hybrid encoding approach for OData parameters:
- Spaces: encoded as `%20`
- Single quotes: left unencoded (keeps string literal structure visible)
- Parentheses: encoded as `%28` and `%29`

This combination keeps the OData syntax readable while encoding the specific characters that trigger WAF pattern matching.

## Change
**File:** `supabase/functions/json-workflow-processor/index.ts`

**Line 1063**

Before:
```javascript
const encodedValue = paramValue.replace(/ /g, '%20');
```

After:
```javascript
const encodedValue = paramValue.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
```

## Expected Result
URL will be encoded as:
```
$filter=name%20eq%20'AMR-BIG%20ISLAND%20%28HAWAII%29%2810100%29'
```

Instead of:
```
$filter=name%20eq%20'AMR-BIG%20ISLAND%20(HAWAII)(10100)'
```

## Other Edge Functions to Update
If this fix works, apply the same change to:
- `csv-workflow-processor`
- `transform-workflow-processor`
