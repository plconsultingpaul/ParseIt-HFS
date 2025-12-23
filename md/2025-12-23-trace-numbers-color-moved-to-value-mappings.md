# Move Color from Field Mappings to Value Mappings in Trace Numbers

**Date:** 2025-12-23

## Summary

Moved the color configuration for trace number fields from the field mapping level to the value mapping level. This allows different values of the same field to have different colors, providing more flexibility and better visual distinction.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/20251223002000_move_color_from_field_to_value_mappings.sql`

- Removes `color` property from trace number field mappings
- Adds `color` property to each value mapping within `valueMappings` array
- Migrates existing color values from field level to all value mappings in that field
- Sets default `gray` color for value mappings without color

### 2. Type Definitions
**File:** `src/types/index.ts`

**TrackTraceValueMapping Interface:**
- Added `color: string` property

**TraceNumberFieldMapping Interface:**
- Removed `color: string` property

### 3. Configuration UI Component
**File:** `src/components/settings/TrackTraceTemplatesSettings.tsx`

**State Changes:**
- Removed `newMappingColor` state for field mappings
- Added `newValueMappingColor` state for value mappings

**Field Mappings Section:**
- Removed color selector dropdown from field mapping form
- Updated grid layout from `cols-12` with color field to simpler layout without it
- Updated description to reflect that color is set in value mappings
- Removed color badge display from field mapping list

**Value Mappings Modal:**
- Added color selector dropdown to value mapping form
- Updated grid layout: Source Value (4 cols), Display Value (4 cols), Color (3 cols), Button (1 col)
- Display each mapping with its color badge
- Updated description to mention color configuration
- Color resets to 'blue' after adding each mapping

### 4. Display Logic
**File:** `src/components/ShipmentDetailsPage.tsx`

**Trace Number Processing:**
- Modified color extraction logic to get color from matched value mapping
- Initializes color as `gray` by default
- When value mapping matches, extracts both `displayValue` AND `color` from the mapping
- If no value mapping matches, uses default `gray` color

## Before and After

### Before
```typescript
// Field mapping had color
interface TraceNumberFieldMapping {
  label: string;
  valueField: string;
  color: string;  // ← Color here
  displayType: 'header' | 'detail';
  valueMappings?: { sourceValue: string; displayValue: string }[];
}
```

All values of a field had the same color.

### After
```typescript
// Value mapping has color
interface TraceNumberFieldMapping {
  label: string;
  valueField: string;
  displayType: 'header' | 'detail';
  valueMappings?: TrackTraceValueMapping[];
}

interface TrackTraceValueMapping {
  sourceValue: string;
  displayValue: string;
  color: string;  // ← Color here
}
```

Each value can have its own color.

## Example Usage

**Field Configuration:**
- Label: "Number"
- Value Field: "traceNumber"
- Display Type: Header

**Value Mappings for this field:**
- "B" → "BOL" [Blue]
- "P" → "PO" [Green]
- "D" → "Delivery Order" [Orange]

**Result:**
- If API returns `traceNumber: "B"`, displays blue badge with "BOL"
- If API returns `traceNumber: "P"`, displays green badge with "PO"
- If API returns `traceNumber: "X"`, displays gray badge with "X" (unmapped value)

## Benefits

1. **More Flexible** - Different values of the same field can have different colors
2. **Better Visual Distinction** - Each trace number type can have a unique color
3. **Part of Transformation** - Color becomes part of the value mapping logic
4. **Backward Compatible** - Migration automatically converts existing configurations

## Migration Behavior

The database migration automatically:
1. Takes the color from each field mapping
2. Applies that color to ALL value mappings within that field
3. Removes the color property from the field mapping level
4. Sets default 'gray' for any mappings missing color

This ensures all existing configurations continue to work with the same visual appearance.
