# Track & Trace OData Field Selection Fix

**Date:** 2025-12-22

## Issue

When adding filter fields in Track & Trace Templates with OData parameter types (`$filter`, `$select`, `$orderBy`), the "API Field (from Spec)" dropdown displayed an incorrect message: "No API schema configured. Upload a JSON schema in Settings to see available fields."

This occurred even when a valid API Spec and Endpoint were selected.

## Root Cause

In `TrackTraceTemplatesSettings.tsx`, the logic for determining whether to use endpoint fields from the API spec only checked for standard parameter types (`query`, `path`, `header`):

```javascript
const useEndpointFields = ['query', 'path', 'header'].includes(field.parameterType || '');
```

OData parameter types (`$filter`, `$select`, `$orderBy`) were not included, causing the code to fall back to using `schemaFieldPaths` from the `order_entry_json_schemas` table - an unrelated table used for Order Entry forms.

## Fix

Updated the logic to:
1. Recognize OData parameter types as valid endpoint field sources
2. For OData types, filter to show response body fields (fields without `[query]`, `[path]`, or `[header]` prefixes)
3. For standard parameter types, continue filtering by the parameter type prefix

### Code Change

**File:** `src/components/settings/TrackTraceTemplatesSettings.tsx`

**Before:**
```javascript
const useEndpointFields = ['query', 'path', 'header'].includes(field.parameterType || '');
const filteredEndpointFields = useEndpointFields
  ? endpointFields.filter(f => f.field_path?.startsWith(`[${field.parameterType}]`))
  : [];
```

**After:**
```javascript
const isODataType = ['$filter', '$select', '$orderBy'].includes(field.parameterType || '');
const isStandardParamType = ['query', 'path', 'header'].includes(field.parameterType || '');
const useEndpointFields = isODataType || isStandardParamType;
const filteredEndpointFields = useEndpointFields
  ? endpointFields.filter(f => {
      if (isODataType) {
        return f.field_path && !f.field_path.startsWith('[query]') && !f.field_path.startsWith('[path]') && !f.field_path.startsWith('[header]');
      }
      return f.field_path?.startsWith(`[${field.parameterType}]`);
    })
  : [];
```

## Behavior After Fix

- OData parameter types now correctly display response body fields from the selected API Spec endpoint
- Standard parameter types (`query`, `path`, `header`) continue to show their respective parameter fields
- The dropdown properly populates with available fields based on the selected API spec
