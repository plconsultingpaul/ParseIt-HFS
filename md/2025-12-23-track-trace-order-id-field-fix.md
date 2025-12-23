# Track & Trace Order ID Field Navigation Fix

**Date:** 2025-12-23

## Problem
The Track & Trace page was using the first select field (e.g., `billNumber`) as the order identifier when navigating to the shipment details page, instead of using the actual `orderId` field from the API response.

## Solution
Added a new `order_id_field_name` configuration field to the `track_trace_templates` table that specifies which field from the API response contains the unique order identifier needed for navigation.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/add_order_id_field_name_to_track_trace_templates.sql`
- Added `order_id_field_name` column to `track_trace_templates` table
- Column is nullable for backward compatibility
- Stores the field name that contains the order identifier for navigation

### 2. Type Updates
**File:** `src/types/index.ts`
- Added `orderIdFieldName?: string` to `TrackTraceTemplate` interface (line 896)
- Added `orderIdFieldName?: string` to `TrackTraceConfig` interface (line 857)

### 3. Track & Trace Page Logic
**File:** `src/components/TrackTracePage.tsx`
- Updated `handleViewRow` function (lines 281-301) to use `config?.orderIdFieldName` instead of the first select field
- Updated template data mapping (line 429) to include `orderIdFieldName: templateData.order_id_field_name`

### 4. Template Settings UI
**File:** `src/components/settings/TrackTraceTemplatesSettings.tsx`
- Added UI field (lines 1452-1469) for configuring the Order ID Field Name
- Field includes helpful description: "Field used for navigation to shipment details"
- Note clarifies: "This field does not need to be displayed in the grid"
- Updated save logic (line 559) to include `order_id_field_name: template.orderIdFieldName || null`
- Updated template loading in `loadInitialData` (line 300) to map `orderIdFieldName: t.order_id_field_name`
- Updated template loading in `loadTemplate` (line 344) to map `orderIdFieldName: templateData.order_id_field_name`

## Usage
1. Navigate to Settings > Track & Trace Templates
2. Edit or create a template
3. In the API Configuration section, enter the field name that contains the order identifier (e.g., "orderId", "order.orderId")
4. Save the template
5. The Track & Trace page will now use this field for navigation to shipment details

## Key Benefits
- **Targeted Fix:** The order ID field is specifically configured and doesn't need to be displayed in the grid
- **Flexible:** Each template can specify a different field name based on their API structure
- **Backward Compatible:** Existing templates without this field configured will simply not navigate (no breaking changes)
