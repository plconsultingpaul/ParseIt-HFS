# JSON Workflow Processor - Rename File Step Fix

## Issue
The `json-workflow-processor` Edge Function was missing the handler for the `rename_file` step type, causing workflows with rename steps to fail with the error: `Unknown step type: rename_file`.

## Root Cause
When the `rename_pdf` step type was updated to `rename_file` in the database migration (`20251024231422_update_rename_pdf_to_rename_file.sql`), the `json-workflow-processor` was not updated to include the handler for this step type. The other workflow processors (`csv-workflow-processor` and `transform-workflow-processor`) had this handler, but it was missing from the JSON processor.

## Solution
Added complete `rename_file` step handler to `json-workflow-processor/index.ts` at line 1523 (before the "Unknown step type" error handler).

### Files Modified
- **`/supabase/functions/json-workflow-processor/index.ts`** (lines 1523-1643)

### Implementation Details

The handler now supports:

1. **Template Processing**
   - Uses `filenameTemplate` from step config
   - Falls back to `pageGroupFilenameTemplate`, `extractionTypeFilename`, or default template
   - Processes `{{placeholder}}` variables from context data
   - Falls back to `lastApiResponse` for missing values

2. **Timestamp Appending**
   - Optional timestamp with configurable formats:
     - `YYYYMMDD` (default)
     - `YYYY-MM-DD`
     - `YYYYMMDD_HHMMSS`
     - `YYYY-MM-DD_HH-MM-SS`

3. **Multi-Format Support**
   - PDF: `renamePdf` → `renamedPdfFilename`
   - CSV: `renameCsv` → `renamedCsvFilename`
   - JSON: `renameJson` → `renamedJsonFilename`
   - XML: `renameXml` → `renamedXmlFilename`

4. **Primary Filename Selection**
   - Prioritizes by format type (JSON, CSV, XML)
   - Falls back to first enabled file type
   - Stores as `contextData.renamedFilename` and `contextData.actualFilename`

5. **Context Data Storage**
   - All renamed filenames stored in context for downstream steps
   - Step output includes `renamedFilenames`, `primaryFilename`, and `baseFilename`

### Configuration Example
```json
{
  "filenameTemplate": "BOL_{{billNumber}}_{{orderID}}",
  "appendTimestamp": true,
  "timestampFormat": "YYYYMMDD",
  "renamePdf": true,
  "renameJson": true,
  "renameCsv": false,
  "renameXml": false
}
```

### Legacy Support
The handler supports both:
- `step.step_type === 'rename_file'` (current)
- `step.step_type === 'rename_pdf'` (legacy)

## Testing
After deploying this fix, workflows using the JSON format with rename steps should execute successfully without the "Unknown step type: rename_file" error.

## Related Files
- `/supabase/functions/csv-workflow-processor/index.ts` - Has rename_file handler
- `/supabase/functions/transform-workflow-processor/index.ts` - Has rename_file handler
- `/supabase/migrations/20251024231422_update_rename_pdf_to_rename_file.sql` - Migration that renamed the step type

## Date
December 7, 2025
