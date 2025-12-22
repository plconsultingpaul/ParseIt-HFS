# Track & Trace Manual Entry Fix - No API Spec Selected

**Date:** 2025-12-22

## Issue

When Track & Trace API Spec was set to "None (Manual Entry)" and adding a Filter Field, the API Field dropdown would show an error message ("No $filter parameters found in API spec.") instead of the "Manual entry" option.

Users expected to see a dropdown with "Manual entry" selected, allowing them to type in a custom API Field Name.

## Root Cause

The logic in `TrackTraceTemplatesSettings.tsx` determined whether to show fields based on parameter type (OData types like `$filter`, `$select`, `$orderBy`). When no API spec was selected:

1. `useEndpointFields = true` (because `$filter` is an OData type)
2. `filteredEndpointFields = []` (empty because no spec = no endpoint fields)
3. `hasOptions = false` (0 > 0 = false)
4. Error message displayed instead of dropdown

The code assumed that if `useEndpointFields` was true and no fields were found, an error should be shown. But this failed to account for the "no spec selected" scenario where manual entry should always be available.

## Solution

Added an early check at the start of the API Field dropdown logic. If no API spec is selected (`template.apiSpecId` is falsy), immediately return a dropdown with only the "Manual entry" option, bypassing all the field-loading logic.

## Changes Made

### File: `src/components/settings/TrackTraceTemplatesSettings.tsx`

Added check for no API spec selected at line 1966:

```typescript
{(() => {
  const noSpecSelected = !template?.apiSpecId;

  if (noSpecSelected) {
    return (
      <Select
        value={field.apiFieldPath || '__none__'}
        onValueChange={(value) => {
          onChange({
            ...field,
            apiFieldPath: value === '__none__' ? undefined : value,
            fieldName: value !== '__none__' ? value : field.fieldName
          });
        }}
        options={[
          { value: '__none__', label: 'Manual entry' }
        ]}
      />
    );
  }

  // ... existing logic for when API spec IS selected
})()}
```

## Result

When API Spec is set to "None (Manual Entry)":
- Dropdown now shows with "Manual entry" selected
- Users can enter custom API Field Names in the text input below
- Error messages only appear when an API spec IS selected but has no matching fields
