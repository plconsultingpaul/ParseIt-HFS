# Mapped Field Coordinate Hints in AI Prompt (Option 3)

**Date:** 2025-12-23

## Summary

Enhanced the AI prompts in both PDF extraction edge functions to include coordinate information for mapped fields as positional hints. This helps Gemini understand where to look on the page when extracting mapped field values.

## Problem

Mapped fields with PDF coordinates were not being communicated effectively to the AI model. The coordinates were captured but Gemini had no guidance on where these fields were located on the page.

## Solution (Option 3)

Instead of cropping images or making additional API calls, we enhance the prompt itself to include coordinate hints for mapped fields. This approach:

- Adds no additional Gemini API calls
- Requires no image cropping
- Maintains current processing speed
- Provides positional guidance to the AI

## Changes Made

### 1. pdf-to-csv-extractor/index.ts

**Location:** Lines 319-329

**Before:**
```typescript
const fieldDescriptions = requestData.fieldMappings
  .filter(m => m.type === 'ai')
  .map(m => `- ${m.fieldName}: ${m.value || 'extract this field'}`)
  .join('\n');
```

**After:**
```typescript
const aiFieldDescriptions = requestData.fieldMappings
  .filter(m => m.type === 'ai')
  .map(m => `- ${m.fieldName}: ${m.value || 'extract this field'}`)
  .join('\n');

const mappedFieldDescriptions = requestData.fieldMappings
  .filter(m => m.type === 'mapped')
  .map(m => `- ${m.fieldName}: Look in the region at coordinates ${m.value} (use these coordinates as a hint to locate the field)`)
  .join('\n');

const fieldDescriptions = [aiFieldDescriptions, mappedFieldDescriptions].filter(Boolean).join('\n');
```

### 2. pdf-transformer/index.ts

**Location:** Line 508

**Before:**
```typescript
fieldMappingInstructions += `- "${mapping.fieldName}": Extract data from PDF coordinates ${mapping.value}${dataTypeNote}\n`
```

**After:**
```typescript
fieldMappingInstructions += `- "${mapping.fieldName}": Look in the region at coordinates ${mapping.value} (use these coordinates as a hint to locate the field)${dataTypeNote}\n`
```

## Testing

After deploying to Supabase, test with:
1. A PDF with mapped fields that have coordinate values
2. Verify the AI correctly identifies and extracts values from the indicated regions
3. If accuracy is insufficient, consider falling back to Option 1 (cropped region extraction)

## Fallback Plan

If Option 3 does not provide sufficient accuracy for mapped field extraction, Option 1 (sending cropped regions of the PDF to Gemini) can be implemented as a more direct approach.
