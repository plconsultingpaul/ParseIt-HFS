# Edge Function Deployment Instructions

## Issue Fixed
The workflow processor was getting 404 errors when making API calls because URL placeholder values containing spaces weren't being properly encoded.

## The Fix
Changed from using `encodeURI()` on the entire URL (which encodes spaces in OData operators) to only encoding spaces in the actual placeholder values:

**Before:**
```typescript
url = url.replace(..., rawValue)
url = encodeURI(url)  // This breaks OData syntax
```

**After:**
```typescript
const encodedValue = rawValue.replace(/ /g, '%20')
url = url.replace(..., encodedValue)  // Only encode values, not syntax
```

## How to Deploy

Since the Supabase CLI isn't available in this environment, please manually redeploy the function:

1. Go to your Supabase Dashboard
2. Navigate to Edge Functions
3. Select the `json-workflow-processor` function
4. Replace the code with the contents of: `supabase/functions/json-workflow-processor/index.ts`
5. Deploy the updated function

## Key Changes
The fix is in lines 397-412 of `index.ts` where URL placeholders are replaced. The encoding now only affects spaces in the actual data values, preserving the OData query syntax structure like:

```
$filter=name eq 'ABC%20Company' and address1 eq '123%20Main%20St'
```

Instead of breaking it with:
```
$filter=name%20eq%20'ABC%20Company'%20and%20address1%20eq%20'123%20Main%20St'
```
