# Trace Numbers Grouped Card Display Fix

**Date:** 2025-12-23

## Problem

When displaying trace numbers from the API response, each field mapping was creating a separate card. For example, if the API returned:

```json
{
  "traceNumbers": [
    {
      "traceType": "B",
      "traceNumber": "12341234"
    }
  ]
}
```

And field mappings were configured for:
- `traceType` (displayType: header, with value mapping B -> "BOL")
- `traceNumber` (displayType: detail)

The result was **two separate cards**: one showing "BOL" and another showing "12341234".

## Solution

Modified `ShipmentDetailsPage.tsx` to group header and detail fields from the same trace array item into a single card.

## Changes Made

### File: `src/components/ShipmentDetailsPage.tsx`

1. **Updated interface** from `TraceNumber` to `TraceNumberCard`:
   - Changed from flat structure with single label/value/color
   - New structure holds both header and detail information together

2. **Modified `fetchTraceNumbers` function**:
   - Instead of iterating through each field mapping and creating separate entries
   - Now finds the header mapping and detail mapping first
   - Creates one combined card per trace array item with header + detail values

3. **Updated rendering logic**:
   - Each card now displays the header value as a colored badge at top
   - Detail label (if present) shows as small gray text
   - Detail value shows as the main content below

## Result

Each trace array item now displays as a single card with:
- Colored badge showing the header value (e.g., "BOL" in blue)
- Detail value displayed below (e.g., "12341234")
