# Shipment Details Trace Numbers Proxy Fix

**Date:** 2025-12-23

## Problem

The Trace Numbers section on the Shipment Details page was showing "No trace numbers found" even when the API endpoint was properly configured with field mappings.

## Root Cause

The `fetchTraceNumbers` function in `ShipmentDetailsPage.tsx` was making **direct browser-to-API calls** using `fetch()`. This failed silently due to **CORS restrictions** - external APIs don't allow direct browser requests.

Meanwhile, `TrackTracePage.tsx` correctly uses the `track-trace-proxy` edge function for all API calls.

## Solution

Modified `fetchTraceNumbers` to use the `track-trace-proxy` edge function instead of making direct API calls.

### Changes Made

**File:** `src/components/ShipmentDetailsPage.tsx`

**Before:**
- Fetched API credentials (base_url, auth_token) from database
- Built the full URL manually
- Made direct browser fetch to external API (blocked by CORS)

**After:**
- Gets endpoint path from `api_spec_endpoints` table
- Replaces path parameters (e.g., `{orderId}`) with actual values
- Calls `track-trace-proxy` edge function with:
  - `apiSourceType`: 'main' or 'secondary'
  - `secondaryApiId`: if using secondary API
  - `apiPath`: processed path with orderId substituted
  - `httpMethod`: 'GET'
  - `queryString`: empty string

## Code Change Summary

Replaced direct fetch call:
```javascript
const response = await fetch(fullUrl, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  }
});
```

With proxy call:
```javascript
const proxyResponse = await fetch(`${supabaseUrl}/functions/v1/track-trace-proxy`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'apikey': supabaseAnonKey
  },
  body: JSON.stringify({
    apiSourceType: config.apiSourceType || 'main',
    secondaryApiId: config.secondaryApiId || '',
    apiPath,
    httpMethod: 'GET',
    queryString: ''
  })
});
```

## Testing

After the fix, the Trace Numbers section should:
1. Successfully call the API endpoint through the proxy
2. Display trace number values with configured field mappings
3. Show proper labels and value mappings as configured
