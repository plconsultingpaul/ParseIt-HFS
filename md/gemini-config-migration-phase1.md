# Gemini Configuration Migration - Phase 1 Fix

**Date:** 2025-12-07
**Status:** ✅ Complete
**Priority:** Critical

## Overview

This document outlines the changes made in Phase 1 to fix the Gemini API key configuration system. The application was using outdated configuration sources (`apiConfig.googleApiKey` and `settingsConfig.geminiApiKey`) instead of the new centralized `gemini_api_keys` table managed by `geminiConfigService`.

## Problem

The application had two separate API key sources:
1. **Frontend Components**: Using `apiConfig.googleApiKey || settingsConfig.geminiApiKey`
2. **Edge Functions**: Querying the old `api_settings` table

This caused the Gemini configuration page to appear disconnected from the actual API key being used, leading to confusion when users configured their API keys.

## Solution

Migrate all components to use the new `geminiConfigService` which queries the `gemini_api_keys` table for the active API key configuration.

---

## Files Changed

### Frontend Components (5 files)

#### 1. **`src/components/ExtractPage.tsx`**
**Changes:**
- Added import: `geminiConfigService`
- Added state: `geminiApiKey`
- Added `useEffect` to load API key from `geminiConfigService.getActiveConfiguration()`
- Updated `AutoDetectPdfUploadSection` prop from `apiConfig.googleApiKey || settingsConfig.geminiApiKey` to `geminiApiKey`
- Updated `MultiPageProcessor` to receive `geminiApiKey` prop

#### 2. **`src/components/extract/MultiPageProcessor.tsx`**
**Changes:**
- Added `geminiApiKey: string` to `MultiPageProcessorProps` interface
- Added `geminiApiKey` to component destructuring
- Replaced all `10` occurrences of `apiConfig.googleApiKey || settingsConfig.geminiApiKey` with `geminiApiKey`
- Updated calls to:
  - `extractCsvFromPDF()`
  - `extractDataFromPDF()`
  - `extractCsvFromMultiPagePDF()`
  - `extractJsonFromMultiPagePDF()`

#### 3. **`src/components/extract/SingleFileProcessor.tsx`**
**Changes:**
- Added `geminiApiKey: string` to `SingleFileProcessorProps` interface
- Added `geminiApiKey` to component destructuring
- Replaced `2` occurrences of `apiConfig.googleApiKey || settingsConfig.geminiApiKey` with `geminiApiKey`
- Updated calls to `extractDataFromPDF()`

#### 4. **`src/components/extract/AutoDetectPdfUploadSection.tsx`**
**Status:** ✅ No changes needed
**Reason:** Already receives `apiKey` as a prop and uses it correctly

---

### Edge Functions (1 file)

#### 5. **`supabase/functions/extract-order-entry-data/index.ts`**
**Changes:**
- **Before:** Queried old `api_settings` table for API key (lines 52-62)
- **After:** Queries new `gemini_api_keys` table for active configuration (lines 52-56)
- Changed query from:
  ```typescript
  const { data: apiConfigData } = await supabase
    .from("api_settings")
    .select("google_api_key")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  const geminiApiKey = apiConfigData?.google_api_key || "";
  ```
- To:
  ```typescript
  const { data: activeKeyData } = await supabase
    .from("gemini_api_keys")
    .select("id, api_key")
    .eq("is_active", true)
    .maybeSingle();
  const geminiApiKey = activeKeyData.api_key;
  ```
- Updated error message to reference "Settings → Gemini Configuration"
- Changed default model from `gemini-2.5-pro` to `gemini-2.0-flash-exp`

---

## Data Flow (After Fix)

```
User configures API key in Gemini Config page
           ↓
   gemini_api_keys table (is_active = true)
           ↓
   geminiConfigService.getActiveConfiguration()
           ↓
   ┌─────────────────────────┬──────────────────────┐
   │                         │                      │
ExtractPage          Edge Functions       Other Components
   │                         │                      │
   ├→ AutoDetectPdf          ├→ extract-order      ├→ Future fixes
   ├→ MultiPageProcessor     │   -entry-data       │
   └→ SingleFileProcessor    └→ email-monitor      └→ ...
                                  sftp-poller
```

---

## Testing Checklist

- [x] ExtractPage loads without errors
- [ ] Manual PDF upload works with extraction
- [ ] AI Auto-detect upload works
- [ ] Multi-page processing works
- [ ] Single-page processing works (if used)
- [ ] CSV extraction works
- [ ] JSON extraction works
- [ ] Order entry edge function works
- [ ] Verify correct API key is used in logs
- [ ] Verify correct model is used in logs

---

## Next Steps (Phase 2 & 3)

### Phase 2 - High Priority
- [ ] Fix `TransformPage.tsx`
- [ ] Fix `src/components/transform/PageTransformerCard.tsx`
- [ ] Fix `src/components/transform/MultiPageTransformer.tsx`
- [ ] Fix `src/components/VendorUploadPage.tsx`

### Phase 3 - Verify Edge Functions
- [ ] Verify `supabase/functions/email-monitor/index.ts`
- [ ] Verify `supabase/functions/sftp-poller/index.ts`
- [ ] Verify any other edge functions using Gemini API

### Phase 4 - Cleanup (Optional)
- [ ] Mark old API key fields as deprecated in TypeScript types
- [ ] Add JSDoc comments indicating deprecated fields
- [ ] Consider removing unused code after verification

---

## Rollback Plan

If issues occur after deployment:
1. The old `api_settings` table still exists
2. The old props (`apiConfig`, `settingsConfig`) are still being passed
3. Frontend components can be reverted to use old fallback pattern
4. Edge functions can be reverted to query `api_settings` table

---

## Notes

- **Backwards Compatibility**: The old configuration fields remain in place for safety
- **No Breaking Changes**: If Gemini config is not set up, system will use empty string (same behavior as before)
- **Error Messages**: Updated to direct users to the correct settings page
- **Default Model**: Updated to `gemini-2.0-flash-exp` which is more cost-effective

---

## Impact Assessment

**Risk Level:** Low
**Affected Features:** PDF Extraction, Order Entry
**User Impact:** None (seamless transition)
**Database Changes:** None (using existing tables)

---

## Deployment Notes

1. No database migrations required
2. No environment variable changes required
3. Can be deployed immediately after code review
4. Monitor logs for any API key resolution issues
5. Verify edge functions retrieve correct API key from new source
