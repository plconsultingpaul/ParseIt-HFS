# Conditional Check is_null Operator Fix

## Date
2025-12-08

## Problem
The conditional check step in workflows was not correctly handling the `is_null` operator. When a user configured a conditional check with "Is Null" condition type, the operator would fall through to the default case which used "exists" logic instead.

This caused the condition to always evaluate incorrectly:
- When `actualValue` was `null`, `conditionMet` returned `false` (should be `true`)
- The workflow would always execute the "failure" branch instead of the "success" branch

## Root Cause
The switch statement in `json-workflow-processor/index.ts` did not have cases for `is_null` or `is_not_null` operators. Unknown operators fell through to the default case which used "exists" logic:

```javascript
default:
  conditionMet = actualValue !== null && actualValue !== undefined && actualValue !== '';
```

## Solution
Added explicit handler cases for `is_null` and `is_not_null` operators in the conditional check switch statement.

## Files Changed
- `supabase/functions/json-workflow-processor/index.ts`

## Changes Made

### Added is_null operator (lines 1955-1959)
```javascript
case 'is_null':
case 'isNull':
  conditionMet = actualValue === null || actualValue === undefined;
  console.log(`🔍 Condition (is_null): ${conditionMet}`);
  break;
```

### Added is_not_null operator (lines 1961-1965)
```javascript
case 'is_not_null':
case 'isNotNull':
  conditionMet = actualValue !== null && actualValue !== undefined;
  console.log(`🔍 Condition (is_not_null): ${conditionMet}`);
  break;
```

## Behavior After Fix
- `is_null`: Returns `true` when value is `null` or `undefined`
- `is_not_null`: Returns `true` when value is NOT `null` and NOT `undefined`

## Deployment
Requires manual deployment to Supabase edge functions.
