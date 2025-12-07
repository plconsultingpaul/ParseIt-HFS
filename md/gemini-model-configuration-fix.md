# Gemini Model Configuration Fix

**Date:** 2025-12-07
**Issue:** Edge Functions were using hardcoded Gemini model names instead of respecting the active model configuration set by the user.

## Problem Description

Users reported that the "Test Connection" feature in Gemini Config Settings worked correctly (using the active model configuration), but when using extraction features, they received errors like:

```
[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [400 ] API key expired.
```

This occurred because their API key had access to `gemini-2.5-pro` (configured as active), but the edge functions were hardcoded to use different models like `gemini-1.5-flash`.

## Root Cause

The frontend code (`src/lib/gemini.ts`, `src/lib/geminiDetector.ts`) correctly queried the database to fetch the active Gemini model configuration. However, all Supabase Edge Functions had hardcoded model names:

- `extract-order-entry-data` → hardcoded to `gemini-1.5-flash`
- `pdf-to-csv-extractor` → hardcoded to `gemini-2.5-pro`
- `pdf-transformer` → hardcoded to `gemini-2.5-pro`
- `email-monitor` → hardcoded to `gemini-2.5-pro`
- `sftp-poller` → hardcoded to `gemini-2.5-pro`

## Solution

Updated all edge functions to query the Supabase database for the active Gemini model configuration before initializing the Google Generative AI client. Each function now:

1. Queries the `gemini_api_keys` table for the active key
2. Queries the `gemini_models` table for the active model associated with that key
3. Uses the configured model name or falls back to `gemini-2.5-pro` if no configuration is found
4. Logs which model is being used for debugging purposes

## Files Changed

### 1. `supabase/functions/extract-order-entry-data/index.ts`

**Previous:** Hardcoded to `gemini-1.5-flash` (line 91)

**Changes:**
- Added model configuration fetching logic (lines 77-101)
- Now uses dynamic `modelName` variable instead of hardcoded value (line 117)

### 2. `supabase/functions/pdf-to-csv-extractor/index.ts`

**Previous:** Hardcoded to `gemini-2.5-pro` (line 159)

**Changes:**
- Added Supabase client import (line 2)
- Added model configuration fetching logic (lines 157-185)
- Now uses dynamic `modelName` variable instead of hardcoded value (line 190)

### 3. `supabase/functions/pdf-transformer/index.ts`

**Previous:** Hardcoded to `gemini-2.5-pro` (line 310)

**Changes:**
- Added Supabase client import (line 4)
- Added model configuration fetching logic (lines 309-337)
- Now uses dynamic `modelName` variable instead of hardcoded value (line 341)

### 4. `supabase/functions/email-monitor/index.ts`

**Previous:** Hardcoded to `gemini-2.5-pro` (lines 468, 861)

**Changes:**
- Added helper function `getActiveModelName()` at the top of the request handler (lines 28-57)
- Updated both AI extraction sections to call `await getActiveModelName()` before initializing model
- Both instances now use dynamic `modelName` variable

### 5. `supabase/functions/sftp-poller/index.ts`

**Previous:** Hardcoded to `gemini-2.5-pro` (line 300)

**Changes:**
- Added Supabase client import (line 3)
- Added model configuration fetching logic inline before model initialization (lines 299-327)
- Now uses dynamic `modelName` variable instead of hardcoded value (line 331)

## Code Pattern Used

All functions now follow this pattern:

```typescript
// Fetch active Gemini model configuration
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const { data: activeKeyData } = await supabase
  .from("gemini_api_keys")
  .select("id")
  .eq("is_active", true)
  .maybeSingle();

let modelName = "gemini-2.5-pro"; // Default fallback
if (activeKeyData) {
  const { data: activeModelData } = await supabase
    .from("gemini_models")
    .select("model_name")
    .eq("api_key_id", activeKeyData.id)
    .eq("is_active", true)
    .maybeSingle();

  if (activeModelData?.model_name) {
    modelName = activeModelData.model_name;
    console.log('Using active Gemini model:', modelName);
  }
}

// Use the fetched model name
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });
```

## Benefits

1. **Consistency:** All parts of the system now respect the user's active Gemini configuration
2. **Flexibility:** Users can easily switch between different Gemini models without code changes
3. **Reliability:** No more "API key expired" errors when using models that aren't accessible with their key
4. **Debugging:** Console logs now show which model is being used for easier troubleshooting
5. **Fallback:** Graceful fallback to `gemini-2.5-pro` if configuration is missing

## Testing Recommendations

1. Set a specific model as active in Gemini Config Settings
2. Test the "Test Connection" feature to verify it uses the correct model
3. Test extraction features:
   - Extract page (manual PDF upload)
   - Order Entry extraction
   - Email monitoring extraction
   - SFTP polling extraction
4. Verify console logs show the correct active model being used
5. Test with an API key that only has access to specific models (e.g., only `gemini-2.5-pro`)

## Migration Notes

No database migrations required. The fix only affects edge function code.

Users should verify their Gemini Config Settings after this update to ensure:
1. They have an active API key configured
2. They have at least one active model selected for that key
3. The selected model is accessible with their API key
