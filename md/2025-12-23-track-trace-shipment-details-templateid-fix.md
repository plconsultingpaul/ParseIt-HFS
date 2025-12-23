# Fix: Track & Trace Navigation Missing templateId Parameter

**Date:** 2025-12-23

## Problem

When clicking "View" on a shipment in the Track & Trace page, users were redirected to a blank shipment details page. The issue was that the `templateId` query parameter was not being passed in the navigation URL.

## Root Cause

In `TrackTracePage.tsx`, the `handleViewRow` function was navigating to the shipment details page without including the `templateId` query parameter:

```typescript
// Before
navigate(`${basePath}/${encodeURIComponent(orderId)}`);
```

The `ShipmentDetailsPage` requires both `orderId` and `templateId` to load the sections properly. Without the `templateId`, the page would remain blank with the console showing:

```
[ShipmentDetailsPage] Missing templateId or orderId - not loading sections
```

## Solution

Updated the navigation call in the `handleViewRow` function to include the `templateId` as a query parameter:

```typescript
// After
navigate(`${basePath}/${encodeURIComponent(orderId)}?templateId=${config?.id || ''}`);
```

## Files Modified

- `src/components/TrackTracePage.tsx` (line 299)

## Impact

- Shipment details page now loads correctly when navigating from Track & Trace
- The `templateId` is properly passed to load the configured sections
- Users can now view full shipment details as expected

## Notes

- The orderId/billNumber mismatch issue remains and will be addressed separately
- This fix applies to both admin and client portal navigation paths
