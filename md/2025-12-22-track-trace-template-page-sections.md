# Track & Trace Template Page Sections Configuration

**Date:** 2025-12-22

## Summary

Added configuration options for shipment details page sections per Track & Trace template. Users can now control which sections appear on the client shipment details page and their display order.

## Changes Made

### Database Migration

Created new table `track_trace_template_sections` with the following structure:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `template_id` | uuid | Foreign key to track_trace_templates |
| `section_type` | text | One of: shipment_summary, shipment_timeline, route_summary, trace_numbers, barcode_details, documents |
| `display_order` | integer | Order in which section appears (1-6) |
| `is_enabled` | boolean | Whether section is visible |
| `config` | jsonb | Placeholder for future section-specific settings |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

Features:
- Automatic creation of default sections when a new template is created (via trigger)
- Existing templates automatically populated with default sections
- Cascade delete when parent template is deleted
- Unique constraint on template_id + section_type

### Type Definitions

Added to `src/types/index.ts`:
- `TrackTraceTemplateSectionType` - Union type for section types
- `TrackTraceTemplateSection` - Interface for section data

### UI Changes

Updated `src/components/settings/TrackTraceTemplatesSettings.tsx`:
- Added "Page Sections" collapsible configuration panel
- Drag-and-drop reordering of sections
- Toggle visibility for each section
- Shows count of visible/total sections
- New `SortableSectionItem` component for drag-and-drop functionality

## Section Types

The 6 configurable sections are:

1. **Shipment Summary** - Overview of shipment details
2. **Shipment Timeline** - Chronological tracking events
3. **Route Summary** - Route and stop information
4. **Trace Numbers** - Associated trace/tracking numbers
5. **Barcode Details** - Barcode scanning information
6. **Documents** - Attached documents and files

## Files Modified

- `supabase/migrations/[timestamp]_create_track_trace_template_sections.sql` (new)
- `src/types/index.ts`
- `src/components/settings/TrackTraceTemplatesSettings.tsx`
