# OData $filter Single Quote Escaping Fix

## Date
2024-12-09

## Problem
API Endpoint workflow steps were failing with `invalidQueryParameter` errors when extracted data values contained single quotes (apostrophes).

Example: When the consignee name was `MARRIOTT'S WAIOHAI BEACH CLUB`, the OData $filter query was malformed:
```
$filter=name eq 'MARRIOTT'S WAIOHAI BEACH CLUB'
```

The OData parser interpreted:
- `'MARRIOTT'` as the complete value
- `S WAIOHAI BEACH CLUB'` as unexpected syntax

## Solution
OData requires single quotes within string values to be escaped by doubling them (`'` becomes `''`).

Correct filter:
```
$filter=name eq 'MARRIOTT''S WAIOHAI BEACH CLUB'
```

## Changes Made

### Files Modified
1. `supabase/functions/transform-workflow-processor/index.ts`
2. `supabase/functions/csv-workflow-processor/index.ts`
3. `supabase/functions/json-workflow-processor/index.ts`

### Code Change
Added single quote escaping for values substituted into `$filter` query parameters:

```typescript
if (isODataFilterParam && rawValue.includes("'")) {
  rawValue = rawValue.replace(/'/g, "''");
  console.log(`Escaped single quotes in $filter param value:`, rawValue);
}
```

This change is applied immediately after the existing `)-(` escaping logic, ensuring all single quotes in substituted values are properly doubled for OData compliance.

## Testing
Test with values containing apostrophes like:
- `MARRIOTT'S WAIOHAI BEACH CLUB`
- `O'BRIEN TRUCKING`
- `MCDONALD'S`

The $filter should now properly escape these values and the API endpoint call should succeed.
