# 2026-02-06 - Response Data Mapping Add Fix

## Problem

When clicking "+ Add Mapping" in the API Endpoint Response Data Mappings section, the new mapping row would appear briefly then immediately disappear. Only the first mapping could ever be kept.

## Root Cause

In `ApiEndpointConfigSection.tsx`, the `updateParentConfig` function aggressively filtered out empty mappings before passing the config to the parent:

```tsx
responseDataMappings: responseDataMappings.filter(m => m.responsePath || m.updatePath).length > 0
  ? responseDataMappings.filter(m => m.responsePath && m.updatePath)
  : undefined,
```

When a new empty mapping was added, the `useEffect` triggered `updateParentConfig()` which stripped the empty row. The parent then called `restoreConfigFromProps()` which overwrote state with only the original mapping, causing the new row to vanish.

## Fix

Changed the filter logic to preserve all mappings (including empty ones) so users can add rows and fill them in:

```tsx
responseDataMappings: responseDataMappings.length > 0
  ? responseDataMappings
  : undefined,
```

## File Changed

- `src/components/settings/workflow/ApiEndpointConfigSection.tsx` (line ~832)
