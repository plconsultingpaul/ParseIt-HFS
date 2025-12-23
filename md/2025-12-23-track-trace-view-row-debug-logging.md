# Track & Trace View Row - Order ID Field Fix

**Date:** 2025-12-23

## Issue

When clicking "View" on a Track & Trace result row, the navigation to shipment details was not working. The `orderId` field was configured in the template but the value was always `undefined` in the row data.

## Root Cause

The `orderIdFieldName` (e.g., "orderId") is configured separately in the template settings, but the API query only requested the display columns (`selectFields`). Since "orderId" was not a display column, it was never included in the `$select` parameter, so the API never returned it.

**Debug output showed:**
- `orderIdFieldName`: "orderId"
- `orderId`: undefined
- `rowKeys`: ['billNumber', 'status', 'pickUpBy', 'deliverBy']

The "orderId" field simply wasn't being fetched from the API.

## Fix Applied

Modified all three locations in `TrackTracePage.tsx` where the `$select` query parameter is built to include the `orderIdFieldName` if it's not already in the select list.

### File Modified

`src/components/TrackTracePage.tsx`

### Code Change (applied in 3 locations)

**Before:**
```typescript
if (selectFields.length > 0) {
  const selectParam = selectFields[0].parameterType === '$select' ? '$select' : 'select';
  queryParts.push(`${selectParam}=${selectFields.map(f => f.fieldName).join(',')}`);
}
```

**After:**
```typescript
if (selectFields.length > 0) {
  const selectParam = selectFields[0].parameterType === '$select' ? '$select' : 'select';
  const fieldNames = selectFields.map(f => f.fieldName);
  if (config?.orderIdFieldName && !fieldNames.includes(config.orderIdFieldName)) {
    fieldNames.push(config.orderIdFieldName);
  }
  queryParts.push(`${selectParam}=${fieldNames.join(',')}`);
}
```

### Locations Fixed

1. **Export CSV function** (~line 150) - Ensures exported data includes order ID
2. **Restore from session state function** (~line 868) - Ensures search from saved state includes order ID
3. **Main search function** (~line 1159) - Ensures primary search includes order ID

## Debug Logging Added

Also added console logging to `handleViewRow` to help diagnose the issue:

```typescript
console.log('[handleViewRow] Debug:', {
  orderIdFieldName,
  orderId,
  rowKeys: Object.keys(row),
  rowData: row
});
```

## Result

The "orderId" field (or whatever field is configured as `orderIdFieldName`) will now be automatically included in API requests, even if it's not a visible display column. The View button will correctly navigate to the shipment details page.
