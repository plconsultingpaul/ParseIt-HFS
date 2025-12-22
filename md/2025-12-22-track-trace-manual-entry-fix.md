# Track & Trace Manual Entry API Field Fix

**Date:** 2025-12-22

## Issue

When the Track & Trace API Spec was set to "None (Manual Entry)", adding a Filter Field would display "No API schema configured. Upload a JSON schema in Settings to see available fields." instead of allowing manual entry of the API field name.

This occurred because the `endpointFields` state array was not being cleared when switching the API Spec to "None (Manual Entry)", causing stale data from a previously selected API spec to persist.

## Root Cause

In `TrackTraceTemplatesSettings.tsx`, two handlers were missing logic to clear/update the `endpointFields` array:

1. **API Spec change handler** - When changing to "None (Manual Entry)", only `apiEndpoints` was cleared, not `endpointFields`
2. **Endpoint change handler** - When changing endpoints, `loadEndpointFields()` was never called

## Changes Made

### File: `src/components/settings/TrackTraceTemplatesSettings.tsx`

**Change 1: API Spec selection handler (lines 1143-1152)**

Added `setEndpointFields([])` when API spec is changed to "None":

```typescript
onValueChange={(value) => {
  const specId = value === '__none__' ? undefined : value;
  setTemplate({ ...template, apiSpecId: specId, apiSpecEndpointId: undefined });
  if (specId) {
    loadEndpointsForSpec(specId);
  } else {
    setApiEndpoints([]);
    setEndpointFields([]);  // Added this line
  }
}}
```

**Change 2: Endpoint selection handler (lines 1168-1182)**

Added logic to load new endpoint fields or clear them when endpoint changes:

```typescript
onValueChange={(value) => {
  const endpointId = value === '__none__' ? undefined : value;
  const endpoint = apiEndpoints.find(e => e.id === endpointId);
  setTemplate({
    ...template,
    apiSpecEndpointId: endpointId,
    apiPath: endpoint?.path || template.apiPath,
    httpMethod: endpoint?.method?.toUpperCase() || template.httpMethod
  });
  if (endpointId) {
    loadEndpointFields(endpointId);  // Added: load fields for new endpoint
  } else {
    setEndpointFields([]);  // Added: clear fields when no endpoint selected
  }
}}
```

## Result

The `endpointFields` state now properly stays in sync with the selected API spec and endpoint configuration. When "None (Manual Entry)" is selected, the fields array is cleared, allowing the filter field modal to correctly show the manual entry input.
