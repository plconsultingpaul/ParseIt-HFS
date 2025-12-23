# Trace Numbers Section Not Showing - Fix

**Date:** December 23, 2025

## Problem

The Trace Numbers section was configured with an API endpoint and field mappings, and the section was enabled in the template settings. However, when viewing a shipment details page, the Trace Numbers section would render but show "Trace number details will be displayed here" instead of fetching and displaying the actual trace number data.

## Root Cause

In `ShipmentDetailsPage.tsx` line 73, the code was checking for a property that no longer exists:

```typescript
if (config.apiSpecEndpointId && config.pathParameterField) {
  await fetchTraceNumbers(config);
}
```

The `pathParameterField` property was removed from the `TraceNumbersSectionConfig` interface when the configuration was changed to use `fieldMappings` array instead. The database config object contains:
- `apiSpecEndpointId` ✅
- `fieldMappings` array ✅
- `pathParameterField` ❌ (does not exist)

Since `config.pathParameterField` was always `undefined`, the condition never passed, and `fetchTraceNumbers()` was never called.

## Fix

Changed the condition on line 73 to check for properties that actually exist:

```typescript
if (config.apiSpecEndpointId && config.fieldMappings && config.fieldMappings.length > 0) {
  await fetchTraceNumbers(config);
}
```

This ensures:
1. An API endpoint is configured
2. Field mappings exist
3. There is at least one field mapping to display

## Result

The Trace Numbers section now properly fetches and displays trace number data when configured.
