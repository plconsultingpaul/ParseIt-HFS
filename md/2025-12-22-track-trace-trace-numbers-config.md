# Track & Trace - Trace Numbers Section Configuration

**Date:** 2025-12-22

## Summary

Added configuration support for the Trace Numbers section in Track & Trace templates. Each section can now have its own configuration stored in the existing `config` jsonb column of the `track_trace_template_sections` table.

## Changes Made

### 1. Type Definitions (`src/types/index.ts`)

Added new `TraceNumbersSectionConfig` interface:

```typescript
interface TraceNumbersSectionConfig {
  apiSourceType: 'main' | 'secondary';
  secondaryApiId?: string;
  apiSpecId?: string;
  apiSpecEndpointId?: string;
  pathParameterField: string;
  labelField: string;
  valueField: string;
  colorMappings: Record<string, string>;
}
```

### 2. TrackTraceTemplatesSettings.tsx

- Added Configure (gear icon) button to the Trace Numbers section in the Page Sections list
- Added `TraceNumbersConfigModal` component with:
  - API Source selection (Main or Secondary)
  - Secondary API dropdown (when secondary selected)
  - API Specification dropdown
  - API Endpoint dropdown (filtered to GET endpoints)
  - Path Parameter Field selection (from main template's select fields)
  - Label Field text input (API response field for badge label)
  - Value Field text input (API response field for trace number value)
  - Color Mappings editor (map label values to colors like blue, purple, red, green, etc.)

### 3. ShipmentDetailsPage.tsx

- Added state management for trace numbers data
- Added `loadTraceNumbersConfig()` to fetch section configuration from database
- Added `fetchTraceNumbers()` to call the configured API endpoint
- Updated Trace Numbers section rendering to:
  - Show loading spinner while fetching
  - Display trace numbers in a responsive grid (4 columns on large screens)
  - Each trace number shows a colored badge with label and the value below
  - Hide section if disabled in template config

## How It Works

1. Admin configures the Trace Numbers section in Template Settings:
   - Selects which API endpoint returns trace numbers
   - Specifies which field from the main search results to use as the path parameter
   - Maps the API response fields to label and value
   - Sets color mappings for different trace types (e.g., BOL = blue, PO = purple)

2. When viewing shipment details:
   - The page loads the trace numbers configuration
   - Calls the configured API endpoint with the order ID
   - Maps the response to display formatted trace number cards

## Database

No new tables created. Uses existing `track_trace_template_sections.config` jsonb column to store the trace numbers configuration.

## Files Modified

- `src/types/index.ts` - Added TraceNumbersSectionConfig type
- `src/components/settings/TrackTraceTemplatesSettings.tsx` - Added configuration modal and handlers
- `src/components/ShipmentDetailsPage.tsx` - Added trace numbers fetching and rendering
