# Template Field Edit Modal - Missing Prop Fix

**Date:** 2025-12-22

## Issue

When clicking "Add Filter" in Track and Trace Template Filter Fields, the application crashed with:

```
ReferenceError: template is not defined
    at TrackTraceTemplatesSettings.tsx:1966:38
```

## Root Cause

The `TemplateFieldEditModal` component referenced `template?.apiSpecId` directly, but `template` is a state variable in the parent component and was not passed as a prop to the modal.

## Fix

Three targeted changes in `TrackTraceTemplatesSettings.tsx`:

1. **Added `noSpecSelected` prop to interface** (line 1874):
   ```typescript
   noSpecSelected: boolean;
   ```

2. **Destructured prop in function signature** (line 1877):
   ```typescript
   function TemplateFieldEditModal({ ..., noSpecSelected }: TemplateFieldEditModalProps)
   ```

3. **Passed prop when calling component** (line 1797):
   ```typescript
   noSpecSelected={!template.apiSpecId}
   ```

4. **Removed invalid reference** - Deleted `const noSpecSelected = !template?.apiSpecId;` since the value is now passed as a prop.

## Files Changed

- `src/components/settings/TrackTraceTemplatesSettings.tsx`
