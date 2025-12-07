# Gemini Configuration Migration - Phase 2

## Overview
Phase 2 of the Gemini API configuration migration focuses on updating the Transform page and related components to use the new centralized `geminiConfigService` instead of reading from deprecated `apiConfig.googleApiKey` and `settingsConfig.geminiApiKey`.

**Status:** ✅ Completed
**Date:** December 7, 2025
**Build Status:** ✅ Success

## Changes Made

### 1. TransformPage.tsx
**Location:** `src/components/TransformPage.tsx`

**Changes:**
- Added import for `geminiConfigService`
- Added `geminiApiKey` state variable
- Added `useEffect` hook to load API key from `geminiConfigService` on component mount
- Updated `AutoDetectPdfUploadSection` to receive `apiKey={geminiApiKey}`
- Updated `MultiPageTransformer` to receive `geminiApiKey={geminiApiKey}`

**Code Added:**
```typescript
import { geminiConfigService } from '../services/geminiConfigService';

const [geminiApiKey, setGeminiApiKey] = useState<string>('');

React.useEffect(() => {
  const loadGeminiApiKey = async () => {
    const config = await geminiConfigService.getActiveConfiguration();
    setGeminiApiKey(config?.apiKey || '');
  };
  loadGeminiApiKey();
}, []);
```

**Props Updated:**
```typescript
<AutoDetectPdfUploadSection apiKey={geminiApiKey} />
<MultiPageTransformer geminiApiKey={geminiApiKey} />
```

---

### 2. PageTransformerCard.tsx
**Location:** `src/components/transform/PageTransformerCard.tsx`

**Changes:**
- Added `geminiApiKey: string` to `PageTransformerCardProps` interface
- Added `geminiApiKey` to component destructuring
- Replaced **all occurrences** of `apiConfig.googleApiKey || settingsConfig.geminiApiKey` with `geminiApiKey`
  - Line 180: In `handlePreviewTransform` function
  - Line 266: In `handleTransformAndUpload` function

**Code Changed:**
```typescript
// Before
apiKey: apiConfig.googleApiKey || settingsConfig.geminiApiKey

// After
apiKey: geminiApiKey
```

---

### 3. MultiPageTransformer.tsx
**Location:** `src/components/transform/MultiPageTransformer.tsx`

**Changes:**
- Updated line 342 in `handleTransformAll` to use `geminiApiKey` prop instead of `apiConfig.googleApiKey || settingsConfig.geminiApiKey`
- Added `geminiApiKey` prop when rendering `PageTransformerCard` component

**Code Changed:**
```typescript
// Before (line 342)
const apiKey = apiConfig.googleApiKey || settingsConfig.geminiApiKey;

// After (line 342)
const apiKey = geminiApiKey;
```

**Component Call Updated:**
```typescript
<PageTransformerCard
  // ... other props
  geminiApiKey={geminiApiKey}
  // ... other props
/>
```

**Note:** This component already received `geminiApiKey` as a prop at line 18, so it just needed to use it consistently.

---

### 4. VendorUploadPage.tsx
**Location:** `src/components/VendorUploadPage.tsx`

**Changes:**
- Added import for `geminiConfigService`
- Added `geminiApiKey` state variable
- Added `useEffect` hook to load API key from `geminiConfigService` on component mount
- Updated `AutoDetectPdfUploadSection` to receive `apiKey={geminiApiKey}` (line 71)
- Updated `MultiPageTransformer` to receive `geminiApiKey={geminiApiKey}` (line 90)

**Code Added:**
```typescript
import { geminiConfigService } from '../services/geminiConfigService';

const [geminiApiKey, setGeminiApiKey] = useState<string>('');

React.useEffect(() => {
  const loadGeminiApiKey = async () => {
    const config = await geminiConfigService.getActiveConfiguration();
    setGeminiApiKey(config?.apiKey || '');
  };
  loadGeminiApiKey();
}, []);
```

**Props Updated:**
```typescript
<AutoDetectPdfUploadSection apiKey={geminiApiKey} />
<MultiPageTransformer geminiApiKey={geminiApiKey} />
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Transform Page Flow                       │
└─────────────────────────────────────────────────────────────┘

1. TransformPage Component
   ├─ On mount: Load API key via geminiConfigService
   ├─ Stores key in state: geminiApiKey
   └─ Passes key down to children
      ├─ AutoDetectPdfUploadSection (apiKey prop)
      └─ MultiPageTransformer (geminiApiKey prop)

2. MultiPageTransformer Component
   ├─ Receives geminiApiKey prop from parent
   ├─ Uses geminiApiKey in handleTransformAll (line 342)
   └─ Passes geminiApiKey to PageTransformerCard

3. PageTransformerCard Component
   ├─ Receives geminiApiKey prop from MultiPageTransformer
   └─ Uses geminiApiKey in API calls
      ├─ handlePreviewTransform (line 180)
      └─ handleTransformAndUpload (line 266)

4. VendorUploadPage Component
   ├─ On mount: Load API key via geminiConfigService
   ├─ Stores key in state: geminiApiKey
   └─ Passes key down to children
      ├─ AutoDetectPdfUploadSection (apiKey prop)
      └─ MultiPageTransformer (geminiApiKey prop)

┌─────────────────────────────────────────────────────────────┐
│                     Data Source                              │
└─────────────────────────────────────────────────────────────┘

geminiConfigService
   └─ Queries: gemini_api_keys table
      └─ Filters: is_active = true
         └─ Returns: Active API key configuration
```

---

## Testing Checklist

### Manual Testing
- [ ] Transform page loads without errors
- [ ] Gemini API key is loaded from geminiConfigService on page mount
- [ ] PDF upload and detection works on Transform page
- [ ] Multi-page transformation processes correctly
- [ ] Individual page preview transformation works
- [ ] Individual page transform & upload works
- [ ] Vendor upload page loads without errors
- [ ] Vendor upload functionality works correctly
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

### Completed (Phase 2)
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
Phase 2 completes the Gemini API configuration migration for all Transform-related components. If additional components are found using the old configuration pattern, they should be updated following this same approach.

---

## Rollback Plan

If Phase 2 changes need to be reverted:

1. **Restore original files from git:**
   ```bash
   git checkout HEAD -- src/components/TransformPage.tsx
   git checkout HEAD -- src/components/transform/PageTransformerCard.tsx
   git checkout HEAD -- src/components/transform/MultiPageTransformer.tsx
   git checkout HEAD -- src/components/VendorUploadPage.tsx
   ```

2. **Verify rollback:**
   ```bash
   npm run build
   ```

3. **Note:** Phase 1 changes can remain in place as they are independent of Phase 2

---

## Impact Assessment

### Breaking Changes
- None. All changes are internal implementation details

### Dependencies
- Requires `geminiConfigService` from Phase 1
- Requires active Gemini API key in database

### Performance
- Minimal impact: API key loaded once on component mount
- No additional database queries during runtime

### User Experience
- No visible changes to users
- Same functionality, different data source
- More maintainable configuration system

---

## Known Issues
None identified during Phase 2 implementation.

---

## Related Documentation
- [Phase 1 Migration](./gemini-config-migration-phase1.md)
- Gemini Configuration Settings (Settings → Gemini Configuration)
- Database Schema: `gemini_api_keys` and `gemini_models` tables
