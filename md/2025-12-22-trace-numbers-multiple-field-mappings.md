# Trace Numbers Configuration - Multiple Field Mappings

**Date:** 2025-12-22

## Summary

Updated the Trace Numbers Configuration to support multiple field mappings and simplified the path parameter handling.

## Changes Made

### 1. Type Definition (`src/types/index.ts`)

- Added new `TraceNumberFieldMapping` interface with `label`, `valueField`, and `color` properties
- Updated `TraceNumbersSectionConfig` to use `fieldMappings: TraceNumberFieldMapping[]` array
- Removed `pathParameterField`, `labelField`, `valueField`, and `colorMappings` properties

### 2. Configuration Modal (`src/components/settings/TrackTraceTemplatesSettings.tsx`)

- Removed Path Parameter Field dropdown (orderId is now always used automatically)
- Replaced separate Label Field, Value Field, and Color Mappings sections with unified Field Mappings UI
- Each field mapping now includes: Label (display name), Value Field (API field), and Color (badge color)
- Users can add multiple field mappings to display multiple trace numbers from a single API response
- Removed `selectFields` prop since path parameter selection is no longer needed

### 3. Shipment Details Page (`src/components/ShipmentDetailsPage.tsx`)

- Simplified path parameter replacement to always use the `orderId` from the URL
- Updated trace number mapping logic to iterate over `fieldMappings` array
- Each configured field mapping extracts its value from the API response
- Only displays trace numbers that have non-empty values

## Migration Notes

Existing configurations using the old format will need to be reconfigured using the new Field Mappings approach. The old single `labelField`/`valueField` approach has been replaced with an array of field mappings that allows defining multiple trace number types.

## Example Configuration

**Old Format:**
```json
{
  "pathParameterField": "orderId",
  "labelField": "traceType",
  "valueField": "traceNumber",
  "colorMappings": { "BOL": "blue", "PO": "green" }
}
```

**New Format:**
```json
{
  "fieldMappings": [
    { "label": "BOL", "valueField": "bolNumber", "color": "blue" },
    { "label": "PO", "valueField": "poNumber", "color": "green" },
    { "label": "Pickup #", "valueField": "pickupNumber", "color": "teal" }
  ]
}
```
