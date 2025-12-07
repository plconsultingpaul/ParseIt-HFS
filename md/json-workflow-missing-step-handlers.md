# JSON Workflow Processor - Missing Step Handlers Fix

## Issue
The `json-workflow-processor` edge function was missing two critical step type handlers that were present in both the `csv-workflow-processor` and `transform-workflow-processor`:
- `sftp_upload`
- `email_action`

This meant JSON workflows could not upload files to SFTP servers or send email notifications, limiting their capabilities compared to CSV and Transform workflows.

## Root Cause
When the JSON workflow processor was originally developed, these two step handlers were not included, creating an inconsistency across the three workflow processors.

## Solution
Added both missing step handlers to the `json-workflow-processor`:

### 1. SFTP Upload Handler (`sftp_upload`)
**Location**: Lines 1418-1650

**Functionality**:
- Fetches SFTP configuration from `sftp_config` table
- Handles multiple file types: PDF, JSON, XML, CSV
- Supports renamed filenames from previous workflow steps
- Properly encodes content based on file type:
  - PDF: Uses base64 encoded data
  - JSON/XML: Converts object data to JSON string and base64 encodes
  - CSV: Uses raw CSV string data
- Constructs payload for `sftp-upload` edge function with all necessary paths
- Provides detailed logging for debugging

**Key Features**:
- Respects renamed filenames from `rename_file` step
- Fallback logic for filename determination
- Comprehensive error handling
- Detailed debug logging for troubleshooting

### 2. Email Action Handler (`email_action`)
**Location**: Lines 1652-1722

**Functionality**:
- Sends email notifications during workflow execution
- Supports dynamic subject and body with variable substitution
- Uses `{{variableName}}` placeholder syntax to inject context data
- Optional CC to the user who initiated the workflow
- Fetches user email from `users` table when `ccUser` flag is enabled

**Key Features**:
- Dynamic placeholder replacement from context data
- CC support with user email lookup
- Comprehensive logging of email configuration
- Graceful error handling if user email lookup fails

## Testing Recommendations
1. **SFTP Upload Testing**:
   - Test with JSON format type workflows
   - Verify renamed filenames are properly used
   - Test all upload types: PDF, JSON, XML, CSV
   - Verify SFTP paths are correctly resolved

2. **Email Action Testing**:
   - Test variable substitution in subject and body
   - Test with and without `ccUser` flag
   - Verify user email lookup works correctly
   - Test with missing context variables (should handle gracefully)

## Files Modified
- `/supabase/functions/json-workflow-processor/index.ts`
  - Added `sftp_upload` handler (233 lines)
  - Added `email_action` handler (71 lines)
  - Total additions: 304 lines

## Parity Status
All three workflow processors now have identical step handler coverage:

| Step Type | JSON Processor | CSV Processor | Transform Processor |
|-----------|---------------|---------------|-------------------|
| `api_call` | ✅ | ✅ | ✅ |
| `api_endpoint` | ✅ | ✅ | ✅ |
| `rename_file`/`rename_pdf` | ✅ | ✅ | ✅ |
| `conditional_check` | ✅ | ✅ | ✅ |
| `sftp_upload` | ✅ (new) | ✅ | ✅ |
| `email_action` | ✅ (new) | ✅ | ✅ |
| `csv_upload` | ✅ | N/A | N/A |
| `json_transform` | ✅ | N/A | N/A |
| `json_upload` | ✅ | N/A | N/A |

## Impact
- JSON workflows can now upload files to SFTP servers
- JSON workflows can now send email notifications
- Full feature parity across all workflow processors
- No breaking changes to existing workflows

## Date
December 7, 2025
