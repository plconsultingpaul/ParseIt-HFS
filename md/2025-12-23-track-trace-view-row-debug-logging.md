# Track & Trace View Row Debug Logging

**Date:** 2025-12-23

## Issue

When clicking "View" on a Track & Trace result row, the navigation to shipment details was not working. The `orderId` field was configured but the value was not being found in the row data.

## Context

- The Order ID Field Name is configured in the template (e.g., "orderId")
- This field exists in the API response but is NOT displayed as a column in the grid
- The value from this field should be used for navigation to the shipment details page

## Change Made

Added debug logging to the `handleViewRow` function in `TrackTracePage.tsx` to diagnose why the orderId lookup is failing.

### File Modified

`src/components/TrackTracePage.tsx`

### Code Added

```typescript
console.log('[handleViewRow] Debug:', {
  orderIdFieldName,
  orderId,
  rowKeys: Object.keys(row),
  rowData: row
});
```

## What to Check in Console

When clicking "View" on a row, check the browser console for:

1. **orderIdFieldName** - The configured field name (should be "orderId")
2. **orderId** - The value found (will be null/undefined if not found)
3. **rowKeys** - All field names available in the row data
4. **rowData** - The complete row object from the API

## Expected Outcome

This logging will reveal:
- Whether the field name matches exactly (case-sensitive)
- Whether the orderId field is actually present in the API response data
- If there's a naming mismatch (e.g., "OrderId" vs "orderId" vs "order_id")
