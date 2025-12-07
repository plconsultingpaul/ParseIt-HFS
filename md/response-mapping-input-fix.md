# Response Mapping Input Fix

## Issue
When typing in the "Response path" or "Update path" input fields in the API Endpoint Configuration section, the text would disappear immediately as the user typed.

## Root Cause
A circular state update loop was causing the inputs to be cleared:

1. User types in input field → triggers `updateResponseMapping()`
2. Updates local `responseDataMappings` state
3. Triggers `useEffect` → calls `updateParentConfig()`
4. Parent component receives config → re-renders
5. Config prop changes → triggers another `useEffect`
6. Calls `restoreConfigFromProps()`
7. Restores `responseDataMappings` from props, overwriting what user just typed

## Solution
Added edit state tracking to prevent restoration while user is actively typing:

### Changes Made

**File:** `src/components/settings/workflow/ApiEndpointConfigSection.tsx`

1. **Added two new refs to track editing state:**
   ```typescript
   const isEditingResponseMappingsRef = useRef(false);
   const editingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   ```

2. **Added focus/blur handlers:**
   ```typescript
   const handleResponseMappingFocus = () => {
     isEditingResponseMappingsRef.current = true;
     if (editingTimeoutRef.current) {
       clearTimeout(editingTimeoutRef.current);
       editingTimeoutRef.current = null;
     }
   };

   const handleResponseMappingBlur = () => {
     if (editingTimeoutRef.current) {
       clearTimeout(editingTimeoutRef.current);
     }
     editingTimeoutRef.current = setTimeout(() => {
       isEditingResponseMappingsRef.current = false;
     }, 300);
   };
   ```

3. **Modified `restoreConfigFromProps()` to skip restoration when editing:**
   ```typescript
   // Skip restoration if user is actively editing to prevent clearing their input
   if (!isEditingResponseMappingsRef.current) {
     if (config.responseDataMappings && Array.isArray(config.responseDataMappings)) {
       setResponseDataMappings(config.responseDataMappings);
     }
     // ... rest of restoration logic
   }
   ```

4. **Added event handlers to both input fields:**
   - Added `onFocus={handleResponseMappingFocus}`
   - Added `onBlur={handleResponseMappingBlur}`

## How It Works

- When user focuses on a response mapping input, `isEditingResponseMappingsRef` is set to `true`
- While true, `restoreConfigFromProps()` skips restoring response mappings from props
- When user blurs (leaves) the input, a 300ms timeout is set before clearing the editing flag
- This prevents restoration during typing while still allowing config updates from external sources

## Result
Users can now type normally in the Response Data Mappings input fields without the text disappearing.
