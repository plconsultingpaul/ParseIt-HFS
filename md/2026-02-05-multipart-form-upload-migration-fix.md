# Multipart Form Upload Migration Fix

**Date:** 2026-02-05

## Issue

Migration `20260122222451_add_multipart_form_upload_step_type.sql` was failing with error:

```
ERROR: 23514: check constraint "workflow_step_logs_step_type_check" of relation "workflow_step_logs" is violated by some row
```

## Root Cause

The `workflow_step_logs` table contains existing rows with `step_type = 'rename_pdf'`, but this value was not included in the new constraint being added by the migration.

## Fix

Added `'rename_pdf'::text` to the `workflow_step_logs_step_type_check` constraint in the migration file.

## Changed File

- `supabase/migrations/20260122222451_add_multipart_form_upload_step_type.sql`
