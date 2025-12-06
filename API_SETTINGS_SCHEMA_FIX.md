# API Settings Schema Fix - Implementation Summary

## Problem
When attempting to save API configuration settings, the application threw a database error:
```
PGRST204: "Could not find the 'order_display_fields' column of 'api_settings' in the schema cache"
```

The save operation failed with a 400 Bad Request error, preventing users from updating API settings including the base path, password, Google API key, and order display configurations.

## Root Cause
The `api_settings` table in the Supabase database was missing two columns that the frontend code expected:
- `order_display_fields` - for storing comma-separated field names
- `custom_order_display_fields` - for storing custom field mapping configurations

**Database Schema (Before Fix):**
```sql
api_settings table:
- id (uuid)
- path (text)
- password (text)
- google_api_key (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

**Frontend Code Expectations:**
The code in `src/services/configService.ts` (lines 65-72) attempts to save:
```typescript
{
  path: config.path,
  password: config.password,
  google_api_key: config.googleApiKey,
  order_display_fields: config.orderDisplayFields,              // ← Missing!
  custom_order_display_fields: config.customOrderDisplayFields, // ← Missing!
  updated_at: new Date().toISOString()
}
```

This mismatch caused Supabase to reject the PATCH request because it couldn't find the columns in its schema cache.

## Solution Implemented

### 1. **Database Migration Created**
Created migration file: `20251206031925_add_order_display_fields_to_api_settings.sql`

This migration adds two new columns to the `api_settings` table:

**Column 1: `order_display_fields`**
- Type: `text`
- Default: Empty string `''`
- Constraint: NOT NULL
- Purpose: Stores comma-separated list of field names to display in order views

**Column 2: `custom_order_display_fields`**
- Type: `jsonb`
- Default: Empty array `'[]'::jsonb`
- Constraint: NOT NULL
- Purpose: Stores array of custom field mapping objects for advanced display configuration

### 2. **Safe Migration Pattern**
The migration uses conditional logic to prevent errors if columns already exist:
```sql
IF NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_name = 'api_settings' AND column_name = 'order_display_fields'
) THEN
  ALTER TABLE api_settings ADD COLUMN order_display_fields text DEFAULT '' NOT NULL;
END IF;
```

This makes the migration idempotent (safe to run multiple times).

## Files Modified

### New Files Created:

1. **`/supabase/migrations/20251206031925_add_order_display_fields_to_api_settings.sql`**
   - Database migration to add missing columns
   - Uses conditional checks for safe execution
   - Includes detailed documentation in comments

2. **`/API_SETTINGS_SCHEMA_FIX.md`** (this file)
   - Complete documentation of the issue and fix
   - Implementation details and testing steps
   - Reference guide for future troubleshooting

### Existing Files (No Changes Required):

The following files already had correct code that expected these columns:
- `src/services/configService.ts` - Fetch and update API config
- `src/hooks/useSupabaseData.ts` - Data management hooks
- `src/types/index.ts` - TypeScript interface definitions
- `src/components/settings/ApiSettings.tsx` - UI component

## How to Apply the Fix

### Option 1: Using Supabase CLI (Recommended)
```bash
# If Supabase CLI is configured
supabase db push
```

### Option 2: Using Supabase Dashboard
1. Open your Supabase project dashboard
2. Navigate to: **SQL Editor** → **New Query**
3. Copy the contents of `supabase/migrations/20251206031925_add_order_display_fields_to_api_settings.sql`
4. Paste into the SQL editor
5. Click **Run** to execute the migration
6. Verify success message appears

### Option 3: Using MCP Tool (If Available)
The migration will be automatically applied using the `mcp__supabase__apply_migration` tool.

## Testing Recommendations

### 1. **Verify Column Creation**
After applying the migration:
- Open Supabase Dashboard → **Table Editor** → **api_settings**
- Confirm both new columns appear:
  - `order_display_fields` (text)
  - `custom_order_display_fields` (jsonb)

### 2. **Test Schema Cache Refresh**
- Wait 30-60 seconds after migration for Supabase to refresh schema cache
- The PGRST204 error specifically mentions "schema cache", so this is critical

### 3. **Test API Settings Save**
- Open your application
- Navigate to: **Settings** → **API Configuration**
- Enter/modify:
  - Base API Path
  - API Password
  - Google Gemini API Key
- Click **Save**
- **Expected Result:** Success message, no errors
- **Verify:** Refresh page and confirm settings persisted

### 4. **Test Order Display Fields**
- In API Configuration section, configure order display fields
- Save configuration
- Navigate to **Orders** page
- **Expected Result:** Custom display fields appear correctly

### 5. **Verify Database Content**
Run this query in Supabase SQL Editor:
```sql
SELECT
  id,
  path,
  order_display_fields,
  custom_order_display_fields,
  updated_at
FROM api_settings
ORDER BY updated_at DESC
LIMIT 1;
```
**Expected Result:** All fields should contain data with no null values.

## Technical Details

### Schema Before vs After

**Before:**
```
api_settings (
  id uuid PRIMARY KEY,
  path text,
  password text,
  google_api_key text,
  created_at timestamptz,
  updated_at timestamptz
)
```

**After:**
```
api_settings (
  id uuid PRIMARY KEY,
  path text,
  password text,
  google_api_key text,
  order_display_fields text DEFAULT '',                    ← NEW
  custom_order_display_fields jsonb DEFAULT '[]'::jsonb,   ← NEW
  created_at timestamptz,
  updated_at timestamptz
)
```

### Data Type Rationale

**Why `text` for order_display_fields?**
- Simple comma-separated string format
- Backward compatible with existing code
- Easy to parse and display
- No complex JSON parsing needed for simple lists

**Why `jsonb` for custom_order_display_fields?**
- Stores array of complex objects: `[{label: "...", field: "...", ...}]`
- Efficient JSON querying if needed in future
- Native PostgreSQL support for JSON operations
- Better than text for structured data

### Frontend Code Integration

The fix aligns with existing frontend interfaces:

**TypeScript Interface** (`src/types/index.ts`):
```typescript
export interface ApiConfig {
  id?: string;
  path: string;
  password: string;
  googleApiKey: string;
  orderDisplayFields: string;                    // → order_display_fields
  customOrderDisplayFields: OrderDisplayMapping[]; // → custom_order_display_fields
}
```

**Service Layer** (`src/services/configService.ts`):
```typescript
// Fetches and transforms snake_case to camelCase
orderDisplayFields: config.order_display_fields || ''
customOrderDisplayFields: JSON.parse(config.custom_order_display_fields)

// Saves and transforms camelCase to snake_case
order_display_fields: config.orderDisplayFields
custom_order_display_fields: config.customOrderDisplayFields
```

## Benefits

✅ **Fixes PGRST204 Error** - API settings save now works correctly

✅ **Schema Alignment** - Database matches frontend expectations

✅ **No Code Changes Needed** - Frontend code already correct

✅ **Backward Compatible** - Default values prevent null issues

✅ **Idempotent Migration** - Safe to run multiple times

✅ **Proper Data Types** - Text for simple fields, JSONB for complex data

✅ **Future-Proof** - Supports advanced order display configurations

## Related Issues

This fix is separate from other potential API configuration issues:

**Gemini API Billing Error:**
If you also see "limit: 0" errors related to Google Gemini API, that's a different issue requiring:
- Valid Google Cloud project with billing enabled
- Gemini API enabled in Google Cloud Console
- Valid API key with proper quotas

**This fix only addresses the database schema mismatch, not API key configuration issues.**

## Rollback Plan (If Needed)

If any issues arise after applying this migration:

### Option 1: Drop Columns
```sql
ALTER TABLE api_settings DROP COLUMN IF EXISTS order_display_fields;
ALTER TABLE api_settings DROP COLUMN IF EXISTS custom_order_display_fields;
```

### Option 2: Modify Frontend
Alternatively, update `src/services/configService.ts` to not send these fields. However, this is **not recommended** as it removes functionality.

### Data Safety
- No existing data is modified by this migration
- Only new columns are added
- All existing configurations remain intact
- No risk of data loss

## Migration History

This migration follows previous API settings migrations:
1. `20250826214700_lively_grass.sql` - Created api_settings table
2. `20250827215953_billowing_torch.sql` - Added google_api_key column
3. `20251206031925_add_order_display_fields_to_api_settings.sql` - Added order display fields (this migration)

## Summary

The fix adds two missing database columns that the frontend code expected, resolving the PGRST204 error when saving API configuration. The migration is safe, backward compatible, and requires no frontend code changes. After applying the migration and waiting for schema cache refresh, API settings save functionality will work correctly.
