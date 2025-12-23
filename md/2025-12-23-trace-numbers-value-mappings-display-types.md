# Trace Numbers: Value Mappings and Display Types

**Date:** 2025-12-23

## Overview
Added value mappings and display type configuration to trace number field mappings, allowing source values to be transformed for display (e.g., B → BOL, P → PO) and distinguishing between header (colored badge) and detail (plain text) fields.

## Changes Made

### 1. Type Definitions (`src/types/index.ts`)
- Updated `TraceNumberFieldMapping` interface to include:
  - `displayType`: 'header' | 'detail' - Controls whether field displays as colored badge or plain text
  - `valueMappings`: Optional array of `TrackTraceValueMapping` - Transforms source values to display values

### 2. Configuration Modal (`src/components/settings/TrackTraceTemplatesSettings.tsx`)

#### Field Mapping List Display
- Added visual distinction between header (colored) and detail (plain text) fields
- Added toggle button to switch display type between header and detail
- Added "Add mappings" / "X mappings" button to edit value mappings
- Automatically enforces only one field can be marked as "header"

#### Add Field Form
- Added "Display" dropdown selector (Header/Detail)
- Added help text explaining header vs detail behavior
- When adding a new header field, automatically converts existing header field to detail

#### Value Mappings Modal
- New modal for configuring value transformations
- Add/remove source value → display value mappings
- Example: "B" → "BOL", "P" → "PO"
- Saved mappings apply to the specific field

### 3. Display Logic (`src/components/ShipmentDetailsPage.tsx`)

#### Trace Number Rendering
- Header fields: Display with colored badge (uses configured color)
- Detail fields: Display as plain black text (no badge)
- Value mappings applied before displaying:
  - Checks if source value matches any mapping
  - If match found, displays the mapped value
  - If no match, displays original value

### 4. Database Migration
- Migration: `add_display_type_value_mappings_to_trace_numbers`
- Updates existing trace number configurations
- Sets first field as 'header', remaining fields as 'detail'
- Adds empty valueMappings array to all existing fields
- Ensures backward compatibility

## Usage

### Configuring Display Types
1. Navigate to Settings → Track & Trace Templates
2. Click "Configure" on a Trace Numbers section
3. For each field mapping:
   - Click the display type button to toggle between "Header (Color)" and "Detail (Text)"
   - Only one field can be set as Header at a time

### Adding Value Mappings
1. In the field mappings list, click "Add mappings" or "X mappings" on any field
2. In the Value Mappings modal:
   - Enter Source Value (e.g., "B")
   - Enter Display Value (e.g., "BOL")
   - Click + to add the mapping
3. Repeat for all value transformations needed
4. Click "Save Mappings"

### Example Configuration
**Field: Type**
- Display Type: Header (Color)
- Color: Blue
- Value Mappings:
  - B → BOL
  - P → PO
  - D → Delivery Order

**Result:** When API returns `traceType: "B"`, the UI displays a blue badge with "Type" label and "BOL" as the value.

## Business Logic

### Display Type Rules
- Exactly one field should be marked as "header" (displays with colored badge)
- All other fields are "detail" (display as plain black text)
- When a new field is set as header, the previous header field automatically becomes detail
- This ensures visual hierarchy where one key identifier stands out

### Value Mappings
- Optional feature - fields work without any mappings
- Applied at display time, not stored in database
- Case-sensitive matching
- If no mapping matches, original value is displayed
- Useful for:
  - Abbreviation expansion (B → BOL)
  - Code translation (1 → Active, 0 → Inactive)
  - User-friendly labels (SHPD → Shipped, DLVD → Delivered)

## Files Modified
- `src/types/index.ts` - Added displayType and valueMappings to TraceNumberFieldMapping
- `src/components/settings/TrackTraceTemplatesSettings.tsx` - Added UI controls and value mappings modal
- `src/components/ShipmentDetailsPage.tsx` - Applied display types and value mappings to rendering
- Database migration: `add_display_type_value_mappings_to_trace_numbers.sql`
