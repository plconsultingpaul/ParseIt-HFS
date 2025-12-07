# Gemini Configuration Migration - Phase 3

## Overview
Phase 3 of the Gemini API configuration migration focuses on updating the Driver Check-In page and edge functions to use the new centralized Gemini API configuration from the `gemini_api_keys` table instead of deprecated `api_settings` and `settings_config` tables.

**Status:** ✅ Completed
**Date:** December 7, 2025
**Build Status:** ✅ Success

## Changes Made

### 1. DriverCheckinPage.tsx
**Location:** `src/components/DriverCheckinPage.tsx`

**Changes:**
- Added import for `geminiConfigService`
- Removed `ApiConfig` type from imports (no longer needed)
- Replaced `apiConfig` state with `geminiApiKey` state
- Removed `loadApiConfig` function that queried `api_settings` table
- Created new `loadGeminiApiKey` function that uses `geminiConfigService`
- Updated `useEffect` to call `loadGeminiApiKey` instead of `loadApiConfig`
- Updated usage at lines 368 and 372 to use `geminiApiKey` instead of `apiConfig.googleApiKey`

**Code Changes:**
```typescript
// Old imports
import type { ExtractionType, DriverCheckinSettings, ApiConfig } from '../types';

// New imports
import type { ExtractionType, DriverCheckinSettings } from '../types';
import { geminiConfigService } from '../services/geminiConfigService';
```

```typescript
// Old state
const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);

// New state
const [geminiApiKey, setGeminiApiKey] = useState<string>('');
```

```typescript
// Old function (removed)
const loadApiConfig = async () => {
  try {
    const { data, error } = await supabase
      .from('api_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    // ...
  } catch (err) {
    console.error('Error loading API config:', err);
  }
};

// New function
const loadGeminiApiKey = async () => {
  try {
    const config = await geminiConfigService.getActiveConfiguration();
    setGeminiApiKey(config?.apiKey || '');
  } catch (err) {
    console.error('Error loading Gemini API key:', err);
  }
};
```

```typescript
// Old usage
if (apiConfig?.googleApiKey && extractionTypes.length > 0) {
  const detectionResult = await detectExtractionType({
    pdfFile: doc.file,
    extractionTypes: extractionTypes,
    apiKey: apiConfig.googleApiKey
  });
}

// New usage
if (geminiApiKey && extractionTypes.length > 0) {
  const detectionResult = await detectExtractionType({
    pdfFile: doc.file,
    extractionTypes: extractionTypes,
    apiKey: geminiApiKey
  });
}
```

---

### 2. email-monitor Edge Function
**Location:** `supabase/functions/email-monitor/index.ts`

**Changes:**
- Removed query to `settings_config` table for `gemini_api_key`
- Changed query from `api_settings` table to `gemini_api_keys` table
- Updated to filter by `is_active = true`
- Updated error messages to reference new configuration location

**Code Changed:**
```typescript
// Old code (lines 203-227)
const { data: apiConfigData, error: apiConfigError } = await supabase
  .from('api_settings')
  .select('*')
  .order('updated_at', { ascending: false })
  .limit(1)
  .single();

if (apiConfigError) {
  console.warn('⚠️ Could not fetch API config:', apiConfigError.message);
}

const apiConfig = apiConfigData || null;

const { data: settingsConfigData, error: settingsConfigError } = await supabase
  .from('settings_config')
  .select('gemini_api_key')
  .order('updated_at', { ascending: false })
  .limit(1)
  .single();

if (settingsConfigError) {
  console.warn('⚠️ Could not fetch settings config:', settingsConfigError.message);
}

const geminiApiKey = settingsConfigData?.gemini_api_key || apiConfig?.google_api_key || '';

// New code
const { data: apiConfigData, error: apiConfigError } = await supabase
  .from('api_settings')
  .select('*')
  .order('updated_at', { ascending: false })
  .limit(1)
  .single();

if (apiConfigError) {
  console.warn('⚠️ Could not fetch API config:', apiConfigError.message);
}

const apiConfig = apiConfigData || null;

const { data: activeKeyData, error: keyError } = await supabase
  .from('gemini_api_keys')
  .select('id, api_key')
  .eq('is_active', true)
  .maybeSingle();

if (keyError) {
  console.error('❌ Error fetching Gemini API key:', keyError.message);
}

if (!activeKeyData) {
  console.error('❌ No active Gemini API key found. Please configure in Settings → Gemini Configuration.');
}

const geminiApiKey = activeKeyData?.api_key || '';
```

**Note:** The `api_settings` query remains because it's used for other API configuration (not Gemini-related).

---

### 3. sftp-poller Edge Function
**Location:** `supabase/functions/sftp-poller/index.ts`

**Changes:**
- Changed query from `api_settings` table to `gemini_api_keys` table at lines 119-138
- Updated to filter by `is_active = true`
- Updated error messages to reference new configuration location

**Code Changed:**
```typescript
// Old code (lines 119-138)
// Get Google Gemini API key for AI detection
const apiSettingsResponse = await fetch(`${supabaseUrl}/rest/v1/api_settings?order=updated_at.desc&limit=1`, {
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
    'apikey': supabaseServiceKey
  }
})

let geminiApiKey = ''
if (apiSettingsResponse.ok) {
  const apiSettings = await apiSettingsResponse.json()
  if (apiSettings && apiSettings.length > 0) {
    geminiApiKey = apiSettings[0].google_api_key || ''
  }
}

if (!geminiApiKey) {
  console.warn('No Google Gemini API key found - AI detection will be skipped')
}

// New code
// Get Google Gemini API key for AI detection
const geminiKeysResponse = await fetch(`${supabaseUrl}/rest/v1/gemini_api_keys?is_active=eq.true&select=id,api_key`, {
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json',
    'apikey': supabaseServiceKey
  }
})

let geminiApiKey = ''
if (geminiKeysResponse.ok) {
  const geminiKeys = await geminiKeysResponse.json()
  if (geminiKeys && geminiKeys.length > 0) {
    geminiApiKey = geminiKeys[0].api_key || ''
  }
}

if (!geminiApiKey) {
  console.warn('No active Gemini API key found - AI detection will be skipped. Please configure in Settings → Gemini Configuration.')
}
```

---

### 4. Edge Functions Verified (No Changes Needed)

The following edge functions receive the Gemini API key as a parameter from the frontend (which was already updated in Phases 1 and 2) and therefore do not need any changes:

- **pdf-to-csv-extractor** - Receives `apiKey` in request body
- **pdf-transformer** - Receives `apiKey` in request body
- **pdf-type-detector** - Receives `apiKey` in request body

These functions were identified during the audit but confirmed to already be using the correct pattern.

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Phase 3 Components Flow                     │
└─────────────────────────────────────────────────────────────┘

1. DriverCheckinPage Component
   ├─ On mount: Load API key via geminiConfigService
   ├─ Stores key in state: geminiApiKey
   └─ Uses key for:
      ├─ AI document detection
      └─ PDF processing workflows

2. email-monitor Edge Function
   ├─ Queries: gemini_api_keys table
   ├─ Filters: is_active = true
   └─ Uses key for:
      ├─ Email attachment processing
      └─ Document type detection

3. sftp-poller Edge Function
   ├─ Queries: gemini_api_keys table
   ├─ Filters: is_active = true
   └─ Uses key for:
      ├─ SFTP file processing
      └─ AI document detection

4. Other Edge Functions (No Changes)
   ├─ pdf-to-csv-extractor
   ├─ pdf-transformer
   └─ pdf-type-detector
      └─ Receive apiKey from frontend (already updated)

┌─────────────────────────────────────────────────────────────┐
│                     Data Source                              │
└─────────────────────────────────────────────────────────────┘

gemini_api_keys table
   └─ Filters: is_active = true
      └─ Returns: Active API key configuration

geminiConfigService (frontend only)
   └─ Queries: gemini_api_keys table
      └─ Returns: Active API key configuration
```

---

## Testing Checklist

### Manual Testing
- [ ] Driver Check-In page loads without errors
- [ ] Driver Check-In document upload and processing works
- [ ] Email monitoring runs without errors
- [ ] SFTP polling runs without errors
- [ ] PDF extraction via edge functions works correctly
- [ ] No console errors related to API key access
- [ ] Error handling works when API key is not configured

### Automated Testing
- [x] `npm run build` succeeds
- [x] No TypeScript compilation errors
- [x] No ESLint errors

---

## Configuration Requirements

### Database
The following must be configured in Supabase:

1. **gemini_api_keys table**
   - At least one record with `is_active = true`
   - Contains valid Gemini API key in `api_key` column

2. **gemini_models table** (optional)
   - Can specify active model per API key
   - If not configured, defaults to `gemini-2.0-flash-exp`

### Settings Page
Users should configure Gemini API keys via:
- **Settings → Gemini Configuration**

---

## Migration Status

### Completed (Phase 3)
- ✅ DriverCheckinPage.tsx
- ✅ email-monitor edge function
- ✅ sftp-poller edge function
- ✅ Verified: pdf-to-csv-extractor (no changes needed)
- ✅ Verified: pdf-transformer (no changes needed)
- ✅ Verified: pdf-type-detector (no changes needed)

### Previously Completed (Phase 2)
- ✅ TransformPage.tsx
- ✅ PageTransformerCard.tsx
- ✅ MultiPageTransformer.tsx
- ✅ VendorUploadPage.tsx

### Previously Completed (Phase 1)
- ✅ ExtractPage.tsx
- ✅ MultiPageProcessor.tsx
- ✅ SingleFileProcessor.tsx
- ✅ AutoDetectPdfUploadSection.tsx (no changes needed)
- ✅ extract-order-entry-data edge function

### Next Steps
**Migration is now complete!** All components and edge functions have been migrated to use the new centralized Gemini API configuration system.

---

## Rollback Plan

If Phase 3 changes need to be reverted:

1. **Restore original files from git:**
   ```bash
   git checkout HEAD -- src/components/DriverCheckinPage.tsx
   git checkout HEAD -- supabase/functions/email-monitor/index.ts
   git checkout HEAD -- supabase/functions/sftp-poller/index.ts
   ```

2. **Verify rollback:**
   ```bash
   npm run build
   ```

3. **Note:** Phases 1 and 2 changes can remain in place as they are independent of Phase 3

---

## Impact Assessment

### Breaking Changes
- None. All changes are internal implementation details

### Dependencies
- Requires `geminiConfigService` from Phase 1 (frontend only)
- Requires active Gemini API key in `gemini_api_keys` database table

### Performance
- Minimal impact: API key loaded once on component mount (frontend)
- Edge functions query database once per execution
- No additional overhead during runtime

### User Experience
- No visible changes to users
- Same functionality, different data source
- More maintainable and centralized configuration system
- Clearer error messages directing users to Settings → Gemini Configuration

---

## Known Issues
None identified during Phase 3 implementation.

---

## Summary

Phase 3 successfully completed the Gemini API configuration migration by updating the Driver Check-In page and two edge functions (email-monitor, sftp-poller) to use the new centralized configuration system. Three additional edge functions (pdf-to-csv-extractor, pdf-transformer, pdf-type-detector) were verified and confirmed to already be using the correct pattern (receiving API key from frontend).

**Migration is now 100% complete** across all frontend components and backend edge functions.

---

## Related Documentation
- [Phase 1 Migration](./gemini-config-migration-phase1.md) - Extract page components and edge function
- [Phase 2 Migration](./gemini-config-migration-phase2.md) - Transform page components
- Gemini Configuration Settings (Settings → Gemini Configuration)
- Database Schema: `gemini_api_keys` and `gemini_models` tables
