/*
  # Add Attachment Page Counts to Processed Emails

  1. New Columns
    - `attachment_page_counts` (text) - Comma-separated list of page counts for each PDF attachment
      - Example: "3, 1, 2" means first PDF has 3 pages, second has 1 page, third has 2 pages
      - Aligns with the order of filenames in `pdf_filenames` column

  2. Purpose
    - Enable visibility into page count per PDF attachment in multi-page documents
    - Allow users to see total pages processed per email
*/

ALTER TABLE processed_emails
ADD COLUMN IF NOT EXISTS attachment_page_counts text;
