# Edge Function Deployment Instructions

## Issue Fixed
JSON workflows were failing because the workflow processor was replaced with a version that didn't handle API call steps properly. When adding CSV extraction support, the json-workflow-processor was incorrectly modified to use a different architecture that only supported email, rename, and SFTP steps.

## The Solution
Created a clean separation between JSON and CSV workflow processing:

1. **Restored JSON Workflow Processor** - Reverted to the working backup that properly handles API calls and all workflow step types
2. **Created CSV Workflow Processor** - Copied the JSON processor as a dedicated CSV-specific function
3. **Smart Routing** - Frontend now automatically routes to the correct processor based on formatType

## Architecture Overview

```
Frontend (src/lib/workflow.ts)
    │
    ├─ formatType === 'CSV' ──→ csv-workflow-processor
    │
    └─ formatType !== 'CSV' ──→ json-workflow-processor
                                (handles JSON, XML, and default)
```

### Workflow Router Logic
- **Extract pages**: Pass `currentExtractionType.formatType`
- **Transform pages**: Always use JSON (transformations are JSON-to-JSON)
- **SFTP poller**: Detects formatType from extraction type configuration

## Files Changed

### Edge Functions Created/Updated
1. `supabase/functions/json-workflow-processor/index.ts` - Restored working version with API call support
2. `supabase/functions/csv-workflow-processor/index.ts` - **NEW** - Dedicated CSV workflow processor
3. `supabase/functions/csv-workflow-processor/deno.json` - **NEW** - Configuration file

### Frontend Updates
1. `src/lib/workflow.ts` - Added smart routing logic based on formatType
2. `src/components/extract/SingleFileProcessor.tsx` - Already passing formatType ✓
3. `src/components/extract/MultiPageProcessor.tsx` - Already passing formatType ✓
4. `src/components/transform/PageTransformerCard.tsx` - Added formatType: 'JSON'
5. `src/components/transform/MultiPageTransformer.tsx` - Added formatType: 'JSON'
6. `supabase/functions/sftp-poller/index.ts` - Added processor routing logic

## How to Deploy

Since the Supabase CLI requires authentication, please manually deploy both functions:

### Step 1: Deploy JSON Workflow Processor

1. Go to your Supabase Dashboard
2. Navigate to Edge Functions
3. Select the `json-workflow-processor` function (or create it if it doesn't exist)
4. Replace the code with the contents of: `supabase/functions/json-workflow-processor/index.ts`
5. Deploy the updated function

### Step 2: Deploy CSV Workflow Processor (NEW)

1. In your Supabase Dashboard Edge Functions
2. Click "Create a new function"
3. Name it: `csv-workflow-processor`
4. Set "Verify JWT" to: **DISABLED** (or --no-verify-jwt)
5. Copy the contents of: `supabase/functions/csv-workflow-processor/index.ts`
6. Deploy the new function

### Step 3: Deploy SFTP Poller (Updated)

1. In your Supabase Dashboard Edge Functions
2. Select the `sftp-poller` function
3. Replace the code with the updated contents of: `supabase/functions/sftp-poller/index.ts`
4. Deploy the updated function

## Testing Verification

After deployment, verify the following:

### Test JSON Extraction with Workflow
1. Go to Extract page
2. Select a JSON extraction type that has a workflow assigned
3. Upload a PDF and click "Extract & Send"
4. Verify the workflow executes successfully and API calls work

### Test CSV Extraction with Workflow
1. Go to Extract page
2. Select a CSV extraction type that has a workflow assigned
3. Upload a PDF and click "Extract & Send"
4. Verify the workflow executes successfully using the CSV processor

### Test Transformations
1. Go to Transform page
2. Select a transformation type with a workflow
3. Transform a PDF
4. Verify the workflow executes successfully (always uses JSON processor)

### Test SFTP Poller
1. Ensure SFTP poller is configured and running
2. Upload a test file to the monitored SFTP directory
3. Verify the file is processed correctly based on its detected format type

## Key Changes in Workflow Processors

### JSON Workflow Processor
- **Default formatType**: JSON
- **Handles**: JSON, XML, and any non-CSV formats
- **Step Types**: API calls, email actions, rename, SFTP upload
- **Use Cases**: Standard JSON/XML workflows, transformations

### CSV Workflow Processor
- **Default formatType**: CSV
- **Handles**: CSV format extractions only
- **Step Types**: Same as JSON processor (API calls, email, rename, SFTP)
- **Use Cases**: CSV extraction workflows

### Router Logic (src/lib/workflow.ts)
```typescript
const formatType = request.formatType || 'JSON';
const processorEndpoint = formatType === 'CSV'
  ? 'csv-workflow-processor'
  : 'json-workflow-processor';
```

## Benefits of This Approach

1. **Immediate Fix** - JSON workflows work again immediately
2. **Clean Separation** - CSV has its own dedicated processor
3. **Future-Proof** - Easy to add more format-specific processors
4. **No Breaking Changes** - Existing workflows continue working
5. **Clear Routing** - Format type automatically determines the processor
6. **Maintainability** - Each processor can evolve independently

## Troubleshooting

### If JSON workflows still fail:
- Check Edge Function logs in Supabase Dashboard
- Verify the json-workflow-processor was deployed with the restored code
- Ensure the frontend build was deployed (workflow router updates)

### If CSV workflows fail:
- Verify csv-workflow-processor was created and deployed
- Check that formatType='CSV' is being passed in the request
- Review Edge Function logs for routing information

### If transformations fail:
- Verify formatType='JSON' is being passed
- Check that json-workflow-processor is handling the request
- Review workflow execution logs in the database
