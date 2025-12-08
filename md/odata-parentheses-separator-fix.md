# OData Consecutive Parentheses Separator Fix

## Date
2025-12-08

## Problem
API requests with OData `$filter` parameters containing consecutive parentheses `)(` in values (e.g., `AMR-BIG ISLAND (HAWAII)(10100)`) were being blocked by Azure Application Gateway WAF with 403 errors.

The `escapeSingleQuotesForOData` function already had logic to replace `)(` with `)-(`, but it was never being called because the condition only checked for single quotes in the extracted value.

## Root Cause
The condition to call `escapeSingleQuotesForOData` only triggered when the extracted value contained a single quote:

```javascript
if (config.escapeSingleQuotesInBody && rawValue.includes("'"))
```

The extracted data value `AMR-BIG ISLAND (HAWAII)(10100)` does not contain single quotes (the quotes are in the template, not the data), so the function was never invoked.

## Solution
Updated the condition to also check for the `)(` pattern:

```javascript
if (config.escapeSingleQuotesInBody && (rawValue.includes("'") || rawValue.includes(")(")))
```

## Changes
**File:** `supabase/functions/json-workflow-processor/index.ts`

**Location 1 - URL replacements (line 622):**
```javascript
// Before
if (config.escapeSingleQuotesInBody && rawValue.includes("'")) {

// After
if (config.escapeSingleQuotesInBody && (rawValue.includes("'") || rawValue.includes(")("))) {
```

**Location 2 - Body replacements (line 688):**
```javascript
// Before
if (config.escapeSingleQuotesInBody && rawValue.includes("'")) {

// After
if (config.escapeSingleQuotesInBody && (rawValue.includes("'") || rawValue.includes(")("))) {
```

## Expected Result
When "Escape Single Quotes for OData Filters" is enabled:

```
AMR-BIG ISLAND (HAWAII)(10100)  ->  AMR-BIG ISLAND (HAWAII)-(10100)
```

URL will become:
```
$filter=name%20eq%20'AMR-BIG%20ISLAND%20(HAWAII)-(10100)'
```

## Activation
This fix applies when the "Escape Single Quotes for OData Filters" checkbox is enabled in the workflow step configuration.
