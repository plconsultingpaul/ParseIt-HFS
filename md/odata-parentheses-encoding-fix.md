# OData Parentheses Encoding Fix

## Date: 2024-12-08

## Problem

API endpoint calls with OData `$filter` parameters were failing with **403 Forbidden** errors from Microsoft Azure Application Gateway when the filter values contained parentheses.

### Example Failing Request

Consignee name: `AMR-BIG ISLAND (HAWAII)(10100)`

The `URLSearchParams` API was encoding the URL as:
```
$filter=name+eq+%27AMR-BIG+ISLAND+%28HAWAII%29%2810100%29%27
```

Where:
- `(` was encoded as `%28`
- `)` was encoded as `%29`
- `'` was encoded as `%27`
- spaces were encoded as `+`

The Azure WAF (Web Application Firewall) was blocking these requests because encoded parentheses can appear similar to SQL injection attack patterns.

## Solution

Modified the `json-workflow-processor` edge function to use **minimal encoding** for OData parameters.

### What Changed

**File:** `supabase/functions/json-workflow-processor/index.ts`

**Before:** Used `URLSearchParams.append()` for all query parameters, which over-encodes special characters.

**After:**
- Detects OData parameters: `$filter`, `$select`, `$orderby`, `$expand`, `$top`, `$skip`, `$count`, `$search`
- For OData parameters: Only encodes spaces as `%20`, leaves parentheses and single quotes unencoded
- For regular parameters: Continues to use standard `encodeURIComponent()` encoding

### New URL Format

```
$filter=name%20eq%20'AMR-BIG%20ISLAND%20(HAWAII)(10100)'
```

This format:
- Passes Azure WAF validation
- Is valid OData syntax
- Preserves special characters that are part of literal string values

## Files Modified

1. `supabase/functions/json-workflow-processor/index.ts` - Query string building logic (lines ~1037-1073)

## Testing

Test with consignee names containing:
- Parentheses: `(HAWAII)(10100)`
- Single quotes: `O'Hare`
- Other special characters

## Future Work

If this fix works, apply the same changes to:
- `supabase/functions/csv-workflow-processor/index.ts`
- `supabase/functions/transform-workflow-processor/index.ts`
