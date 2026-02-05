# Multipart Form Upload Migration Fix

**Date:** 2026-02-05

## Issue

The migration `20260122222451_add_multipart_form_upload_step_type.sql` was failing with error:

```
ERROR: 23514: check constraint "workflow_step_logs_step_type_check" of relation "workflow_step_logs" is violated by some row
```

## Root Cause

The `workflow_step_logs` table contained 101 rows with `step_type = 'rename_pdf'` (a legacy step type). The new constraint did not include this value, causing the constraint to fail when applied to existing data.

## Fix

Added `'rename_pdf'::text` to the `workflow_step_logs_step_type_check` constraint array:

```sql
ALTER TABLE workflow_step_logs ADD CONSTRAINT workflow_step_logs_step_type_check
CHECK (step_type = ANY (ARRAY[
  'api_call'::text,
  'api_endpoint'::text,
  'conditional_check'::text,
  'data_transform'::text,
  'sftp_upload'::text,
  'email_action'::text,
  'rename_file'::text,
  'rename_pdf'::text,        -- Added this line
  'multipart_form_upload'::text
]));
```

## Files Changed

- `supabase/migrations/20260122222451_add_multipart_form_upload_step_type.sql` - Added `rename_pdf` to constraint
