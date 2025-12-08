# Conditional Check fieldPath Template Markers Fix

## Date
2025-12-08

## Problem
The conditional check step was always returning `actualValue: null` even when the data existed at the specified path. This caused `is_null` operator to return `true` when it should have returned `false`.

Example: When checking `{{orders[0].consignee.clientId}}` where `clientId` was `"0000013678"`, the condition incorrectly returned:
- `actualValue`: `null`
- `conditionMet`: `true`

## Root Cause
The `fieldPath` configuration value contained template markers `{{` and `}}` (e.g., `{{orders[0].consignee.clientId}}`). These markers were being passed directly to `getValueByPath()` without being stripped.

When `getValueByPath()` splits the path by `.`, `[`, and `]`, the result was:
- `['{{orders', '0', 'consignee', 'clientId}}']`

This caused the function to look for a property literally named `{{orders` which doesn't exist, returning `undefined`/`null`.

## Solution
Strip the `{{` and `}}` template markers from the fieldPath before passing it to `getValueByPath()`.

## Files Changed
- `supabase/functions/json-workflow-processor/index.ts` (lines 1928-1929)

## Changes Made

### Before (line 1928)
```javascript
const fieldPath = config.fieldPath || config.checkField || '';
```

### After (lines 1928-1929)
```javascript
const rawFieldPath = config.fieldPath || config.checkField || '';
const fieldPath = rawFieldPath.replace(/^\{\{|\}\}$/g, '');
```

## Behavior After Fix
- Template markers `{{` and `}}` are stripped from the fieldPath
- `getValueByPath()` receives clean path like `orders[0].consignee.clientId`
- The actual value is correctly resolved from contextData
- Conditional operators (`is_null`, `is_not_null`, etc.) evaluate correctly

## Deployment
Requires manual deployment to Supabase edge functions.
