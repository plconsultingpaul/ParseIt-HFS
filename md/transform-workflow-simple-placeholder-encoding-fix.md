# Transform Workflow Processor - Simple Placeholder URL Encoding Fix

**Date:** December 9, 2025
**File:** `supabase/functions/transform-workflow-processor/index.ts`
**Line Changed:** 664
**Status:** ✅ Fixed

## Problem

The transform-workflow-processor had inconsistent URL encoding behavior:

- **Complex placeholders** (e.g., `{{extractedData.filename}}`) were properly encoded using `encodeURIComponent()` (Line 655)
- **Simple placeholders** (e.g., `{{filename}}`) were NOT encoded (Line 664)

This meant that values containing special characters like `#`, `&`, `?`, etc. in simple placeholders would break URLs.

### Example Failure Case

**Scenario:** URL path replacement with hash character
```
URL: https://api.example.com/files/{{filename}}
Value: document#1.pdf
Result (BEFORE): https://api.example.com/files/document#1.pdf
                 ❌ Browser treats #1.pdf as URL fragment, not part of path
Expected (AFTER): https://api.example.com/files/document%231.pdf
                  ✅ Properly encoded
```

## Root Cause

Line 664 was missing URL encoding:

```typescript
const encodedValue = replacementValue;  // No encoding applied
```

While Line 655 (complex placeholders) correctly used:

```typescript
const encodedValue = encodeURIComponent(rawValue);  // Proper encoding
```

## Solution

Changed Line 664 to apply the same encoding as complex placeholders:

```typescript
// BEFORE
const encodedValue = replacementValue;

// AFTER
const encodedValue = encodeURIComponent(replacementValue);
```

## Impact

### Characters Now Properly Encoded

| Character | Raw | Encoded | Use Case |
|-----------|-----|---------|----------|
| `#` | # | %23 | Apartment/Suite numbers |
| `&` | & | %26 | Company names with ampersands |
| `?` | ? | %3F | Question marks in text |
| `=` | = | %3D | Equals in values |
| `+` | + | %2B | Plus signs |
| Space | ` ` | %20 | Spaces in filenames/values |
| `/` | / | %2F | Forward slashes |

### Consistency Achieved

Both simple and complex URL placeholder replacements now use identical encoding logic:

- Line 655 (Complex): `encodeURIComponent(rawValue)`
- Line 664 (Simple): `encodeURIComponent(replacementValue)` ✅ **Now consistent**

## Testing Recommendations

### Test Case 1: Hash Character in URL Path
```json
{
  "url": "https://api.example.com/files/{{filename}}",
  "contextData": {
    "filename": "report#2024.pdf"
  }
}
```
**Expected:** `https://api.example.com/files/report%232024.pdf`

### Test Case 2: Multiple Special Characters
```json
{
  "url": "https://api.example.com/search/{{query}}",
  "contextData": {
    "query": "test & demo #1"
  }
}
```
**Expected:** `https://api.example.com/search/test%20%26%20demo%20%231`

### Test Case 3: Ampersand
```json
{
  "url": "https://api.example.com/company/{{name}}",
  "contextData": {
    "name": "Smith & Co"
  }
}
```
**Expected:** `https://api.example.com/company/Smith%20%26%20Co`

## Related Fixes

This fix complements:
- **odata-hash-character-encoding-fix.md** - Fixed json-workflow-processor query parameter encoding
- Both csv-workflow-processor and transform-workflow-processor already use `URLSearchParams.append()` for query parameters, which auto-encodes

## Deployment Notes

**Manual Supabase Deployment Required:**
```bash
# When ready to deploy
supabase functions deploy transform-workflow-processor
```

## Files Modified

1. `supabase/functions/transform-workflow-processor/index.ts` (Line 664)
2. `md/transform-workflow-simple-placeholder-encoding-fix.md` (This documentation)

## Risk Assessment

**Risk Level:** Low
**Breaking Changes:** None
**Backwards Compatibility:** ✅ Improved - URLs that previously failed will now work

### Potential Issues

If any existing workflow was manually URL-encoding values before passing them to simple placeholders, those values will now be double-encoded. However:
- This is unlikely as it would require workarounds
- Complex placeholders already required non-encoded input
- Query parameters already require non-encoded input

## Verification

After deployment, verify:
1. ✅ Simple URL placeholders encode special characters
2. ✅ Complex URL placeholders still work (no regression)
3. ✅ Query parameters still work (unchanged - uses URLSearchParams)
4. ✅ Workflows with hash characters in addresses complete successfully
