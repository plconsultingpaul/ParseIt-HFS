# Track & Trace Shipment Details Page - Section Visibility Fix

**Date:** December 23, 2025

## Problem

When hiding sections in the Track & Trace template settings (e.g., Barcode Details), the visibility toggle was saved correctly to the database but the sections still displayed on the shipment details page. Only the "Trace Numbers" section was respecting the visibility setting.

## Root Cause

The `ShipmentDetailsPage.tsx` component had hard-coded sections that always rendered regardless of the `is_enabled` field in the database. Only the Trace Numbers section had conditional rendering logic.

## Changes Made

### File: `src/components/ShipmentDetailsPage.tsx`

1. **Added state for enabled sections**
   - Added `enabledSections` state to store all enabled sections from the database

2. **Replaced `loadTraceNumbersConfig()` with `loadTemplateSections()`**
   - Now loads ALL template sections from the database
   - Filters sections by `is_enabled = true`
   - Sorts sections by `display_order`
   - Extracts and processes the Trace Numbers section if present

3. **Created `renderSection()` function**
   - Dynamically renders sections based on their `section_type`
   - Supports all 6 section types:
     - `shipment_summary`
     - `shipment_timeline`
     - `route_summary`
     - `trace_numbers`
     - `barcode_details`
     - `documents`

4. **Simplified render logic**
   - Removed all hard-coded section JSX
   - Replaced with dynamic rendering: `{enabledSections.map(section => renderSection(section))}`
   - Sections now automatically respect visibility settings and display order from the database

## Result

All sections on the shipment details page now respect the visibility settings configured in the Track & Trace template settings. Hidden sections will not appear, and sections are displayed in the order specified by the `display_order` field.

## Testing

To verify the fix:
1. Navigate to Settings > Track & Trace Templates
2. Select a template and expand "Page Sections"
3. Uncheck the "Show" checkbox for any section (e.g., Barcode Details)
4. Navigate to Track & Trace and click on a shipment
5. The hidden section should not appear on the shipment details page
6. Re-enable the section and verify it reappears
