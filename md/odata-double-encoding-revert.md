# OData Query Parameter Encoding Fix - Revert Double Encoding

**Date:** December 8, 2025
**Issue:** Double encoding of special characters in OData filter parameters
**Affected Components:** All workflow processor Edge Functions
- `json-workflow-processor`
- `csv-workflow-processor`
- `transform-workflow-processor`

## Problem

When workflow API endpoint steps substituted variables containing special characters (e.g., parentheses `()`) into OData query parameters, the values were being double-encoded:

- First encoding: `encodeURIComponent()` applied to variable values → `%20`, `%28`, `%29`
- Second encoding: `URLSearchParams.append()` automatically encodes again → `%2520`, `%2528`, `%2529`

### Example

**Input Value:** `AMR-BIG ISLAND (HAWAII) (10100)`

**After First Encoding:** `AMR-BIG%20ISLAND%20%28HAWAII%29%20%2810100%29`

**After URLSearchParams (Double Encoded):** `AMR-BIG%2520ISLAND%2520%2528HAWAII%2529%2520%25210100%2529`

This caused the API server (Microsoft Azure Application Gateway) to return `403 Forbidden` errors because the query string was malformed.

## Root Cause

Added `encodeURIComponent()` to variable replacement logic without considering that `URLSearchParams.append()` automatically encodes parameter values. This resulted in double encoding.

## Solution

**Reverted the encoding change** to let `URLSearchParams` handle all encoding naturally:

### Changed Code Locations

All three workflow processors had identical code that needed reverting:

1. **File:** `supabase/functions/json-workflow-processor/index.ts` (Lines 1050-1052)
2. **File:** `supabase/functions/csv-workflow-processor/index.ts` (Lines 894-896)
3. **File:** `supabase/functions/transform-workflow-processor/index.ts` (Lines 1045-1047)

### Before (Incorrect - Double Encoding)
```typescript
const value = getValueByPath(contextData, variableName);
if (value !== undefined && value !== null) {
  // URL encode special characters (including parentheses) to prevent OData parsing issues
  // This is critical for values containing (), [], {}, and other special chars
  const encodedValue = encodeURIComponent(String(value));
  console.log(`🔄 Replaced query param variable ${match} with: ${value} (encoded: ${encodedValue})`);
  return encodedValue;
}
```

### After (Correct - Single Encoding)
```typescript
const value = getValueByPath(contextData, variableName);
if (value !== undefined && value !== null) {
  console.log(`🔄 Replaced query param variable ${match} with:`, value);
  return String(value);
}
```

## Technical Details

`URLSearchParams.append(key, value)` automatically applies proper URL encoding to both keys and values according to the `application/x-www-form-urlencoded` specification. By passing unencoded values to `append()`, the encoding happens once and correctly.

## Testing Notes

After this revert, test with values containing:
- Parentheses: `(` and `)`
- Square brackets: `[` and `]`
- Spaces
- Special characters: `&`, `=`, `?`, `#`

Monitor workflow execution logs to verify proper encoding and successful API responses.

## Deployment

- ✅ GitHub: Updated edge function
- ⏳ Supabase: Deploy manually via Supabase dashboard

## Related Files

- Edge Function: `supabase/functions/json-workflow-processor/index.ts`
- Edge Function: `supabase/functions/csv-workflow-processor/index.ts`
- Edge Function: `supabase/functions/transform-workflow-processor/index.ts`
