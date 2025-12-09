# OData Hash Character Encoding Fix

**Date:** December 9, 2025
**Issue:** API Endpoint Failing with Invalid $filter Query Parameter Due to Unencoded Hash Character

## Problem Description

API endpoint workflow steps were failing with 400 Bad Request errors when OData filter query parameters contained hash/pound characters (`#`) in the values. The API was receiving incomplete/malformed $filter parameters.

### Example Failing Case

**Input Data:**
- Address: `500 ALAKAWA ST #118`
- OData Filter: `name eq '{{orders.0.consignee.name}}' and address1 eq '{{orders.0.consignee.address1}}' and isInactive eq 'False'`

**Error:**
```json
{
  "errors": [{
    "code": "InvalidQueryParameter",
    "description": "Properties specified within the $filter query parameter are not valid."
  }]
}
```

**Generated URL (Broken):**
```
https://honxpsmd.tmwcloud.com/masterData/clients?limit=1&$filter=name%20eq%20'MID%20CITY%20RESTAURANT'%20and%20address1%20eq%20'500%20ALAKAWA%20ST%20#118'&$select=clientId,Name,address1
```

### Root Cause

The hash character (`#`) has special meaning in URLs - it denotes a **URL fragment** (anchor). When `#` appears unencoded in a URL, everything after it is treated as a fragment identifier and **is not sent to the server**.

In the failing case above, the server only received:
```
$filter=name eq 'MID CITY RESTAURANT' and address1 eq '500 ALAKAWA ST
```

Everything after `#118'` (including the rest of the filter conditions) was cut off, resulting in an invalid/incomplete OData query.

### Why This Happened

The `json-workflow-processor` uses **minimal encoding** for OData parameters to avoid issues with Azure WAF blocking over-encoded URLs (see previous fixes). However, the minimal encoding logic only encoded spaces:

```typescript
const encodedValue = paramValue.replace(/ /g, '%20');
```

Critical URL-reserved characters like `#` were not being encoded, causing URL truncation.

## Solution Implemented

Added hash character encoding to the minimal encoding logic for OData parameters in `json-workflow-processor`.

### File Changed

- `supabase/functions/json-workflow-processor/index.ts` (Line 1070)

### Code Change

**Before:**
```typescript
const encodedValue = paramValue.replace(/ /g, '%20');
```

**After:**
```typescript
const encodedValue = paramValue.replace(/ /g, '%20').replace(/#/g, '%23');
```

### Why This Fix Works

1. **Preserves Minimal Encoding Philosophy:** Only encodes absolutely necessary characters (space and hash)
2. **Prevents URL Truncation:** Hash characters are now properly encoded as `%23`
3. **Maintains Azure WAF Compatibility:** Doesn't over-encode like `encodeURIComponent()` which was causing 403 errors
4. **Preserves OData Syntax:** Parentheses and quotes remain unencoded as intended

## Impact

### Characters Now Encoded in OData Parameters

| Character | Encoded As | Reason |
|-----------|------------|--------|
| Space ` ` | `%20` | URL syntax - spaces must be encoded |
| Hash `#` | `%23` | URL syntax - denotes fragment, must be encoded |
| Parentheses `()` | Not encoded | OData compatible, passes Azure WAF |
| Quotes `'` | Not encoded | Required for OData string literals |

### Example Transformation

**Input Filter:**
```
name eq '{{orders.0.consignee.name}}' and address1 eq '{{orders.0.consignee.address1}}' and isInactive eq 'False'
```

**With Values:**
- name: `MID CITY RESTAURANT`
- address1: `500 ALAKAWA ST #118`

**Before Fix (Hash Not Encoded):**
```
$filter=name%20eq%20'MID%20CITY%20RESTAURANT'%20and%20address1%20eq%20'500%20ALAKAWA%20ST%20#118'%20and%20isInactive%20eq%20'False'
```
☠️ **Server receives only:** `$filter=name eq 'MID CITY RESTAURANT' and address1 eq '500 ALAKAWA ST` (truncated at `#`)

**After Fix (Hash Properly Encoded):**
```
$filter=name%20eq%20'MID%20CITY%20RESTAURANT'%20and%20address1%20eq%20'500%20ALAKAWA%20ST%20%23118'%20and%20isInactive%20eq%20'False'
```
✅ **Server receives complete filter:** `$filter=name eq 'MID CITY RESTAURANT' and address1 eq '500 ALAKAWA ST #118' and isInactive eq 'False'`

## Why Only json-workflow-processor?

The three workflow processors use different encoding strategies:

- **json-workflow-processor:** Custom minimal encoding (only space → %20, now also # → %23)
- **csv-workflow-processor:** Uses `URLSearchParams.append()` which automatically encodes all special characters including `#`
- **transform-workflow-processor:** Uses `URLSearchParams.append()` which automatically encodes all special characters including `#`

Only the json-workflow-processor needed this fix because it's the only one using custom minimal encoding.

## Testing Recommendations

After deploying to Supabase, test with addresses containing:

1. **Hash Characters:**
   - `123 Main St #456`
   - `Suite #10B`
   - `Unit #2-A`

2. **Still Test Previous Fixes:**
   - Parentheses: `BIG ISLAND (HAWAII)(10100)` - should work
   - Adjacent parentheses: `(TEST)(123)` - should be converted to `(TEST)-(123)`
   - Spaces: `MULTI WORD NAME` - should encode to `MULTI%20WORD%20NAME`

3. **Edge Cases:**
   - Multiple hashes: `#1 Building #A`
   - Hash with parentheses: `Suite #5 (North Wing)`
   - Hash at end: `PO Box 123#`

## Related Previous Fixes

This fix builds upon the OData encoding work done previously:

1. **odata-special-character-encoding-fix.md** - Initial attempt to encode all special chars (caused double encoding)
2. **odata-double-encoding-revert.md** - Reverted to prevent double encoding
3. **odata-parentheses-encoding-fix.md** - Implemented minimal encoding (space only) for OData params
4. **odata-parentheses-separator-fix-all-processors.md** - Added `)( → )-(` escaping
5. **THIS FIX** - Added hash character encoding to minimal encoding logic

## Deployment Instructions

**GitHub:** ✅ Updated (local changes made)

**Supabase:** ⏳ Manual deployment required

To deploy to Supabase:
1. Open Supabase Dashboard
2. Navigate to Edge Functions
3. Manually deploy `json-workflow-processor` function
4. Test with the failing case (address containing `#118`)

## Files Modified

- `supabase/functions/json-workflow-processor/index.ts` (Line 1070)

## Technical Notes

### URL Fragment Specification

Per RFC 3986, the hash character (`#`) is reserved for denoting the start of a URI fragment:
```
https://example.com/path?query=value#fragment
                                      ↑
                            Everything after # is the fragment
```

When `#` appears in query parameter values, it must be percent-encoded as `%23` to prevent misinterpretation.

### Minimal Encoding Strategy

The minimal encoding approach for OData parameters is necessary because:
1. Azure WAF blocks heavily encoded URLs (sees them as potential attacks)
2. OData syntax requires certain unencoded characters (quotes for strings, parentheses for functions)
3. Only URL-reserved characters (space, hash, ampersand, etc.) need encoding
4. Other special characters can remain unencoded for better WAF compatibility
