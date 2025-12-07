/*
  # Add Page Index to Extraction Group Data

  ## Overview
  This migration adds page_index tracking to enable "Follow Previous Group" to correctly
  reference the immediately preceding page, not just any previous group with a lower group_order.

  ## Problem Fixed
  Previously, when processing a PDF with multiple document sets (e.g., pages 3-4 are one invoice+DR,
  pages 5-6 are another invoice+DR), Group 4 (page 6) would incorrectly use data from Group 1 (page 3)
  instead of Group 3 (page 5) because both had the same group_order value.

  ## Changes
  - Add `page_index` column to track individual page positions within the session
  - Drop old unique constraint on (session_id, group_order)
  - Add new unique constraint on (session_id, page_index)
  - Add index on (session_id, page_index) for fast lookups
  - Add constraint to ensure page_index is non-negative

  ## Example Usage After Fix
  - Page 3 (Group 1, groupOrder=1, pageIndex=0) → Extracts BOL12345
  - Page 4 (Group 2, groupOrder=2, pageIndex=1) → Uses BOL12345 from pageIndex=0 ✅
  - Page 5 (Group 3, groupOrder=1, pageIndex=2) → Extracts BOL67890
  - Page 6 (Group 4, groupOrder=2, pageIndex=3) → Uses BOL67890 from pageIndex=2 ✅
*/

-- Add page_index column to track individual page positions
ALTER TABLE extraction_group_data
ADD COLUMN IF NOT EXISTS page_index integer;

-- Drop old unique constraint (session_id, group_order) that prevents multiple pages with same group
ALTER TABLE extraction_group_data
DROP CONSTRAINT IF EXISTS unique_session_group_order;

-- Add new unique constraint (session_id, page_index) - each page is unique per session
ALTER TABLE extraction_group_data
ADD CONSTRAINT unique_session_page_index
UNIQUE (session_id, page_index);

-- Add index for fast page-based lookups
CREATE INDEX IF NOT EXISTS idx_extraction_group_data_session_page
  ON extraction_group_data(session_id, page_index);

-- Ensure page_index is non-negative
ALTER TABLE extraction_group_data
ADD CONSTRAINT check_extraction_group_data_page_index_nonnegative
CHECK (page_index >= 0);