/*
  # Convert Notification Templates to HTML Format

  1. Purpose
    - Converts existing plain text notification templates to HTML format
    - Replaces plain text newlines with <br> tags for proper HTML rendering
    - Ensures backward compatibility with templates that may already contain HTML

  2. Changes
    - Updates `notification_templates` table
    - Converts only plain text templates (excludes templates already containing HTML tags)
    - Preserves all other template data

  3. Safety
    - Only updates templates without HTML tags
    - Non-destructive operation (existing HTML templates remain unchanged)
    - Can be rolled back by manual restoration if needed
*/

-- Convert plain text newlines to HTML <br> tags in body_template
-- Only update templates that don't already contain HTML tags
UPDATE notification_templates
SET body_template = REPLACE(body_template, E'\n', '<br>')
WHERE body_template NOT LIKE '%<%'
  AND body_template NOT LIKE '%>%'
  AND body_template LIKE '%' || E'\n' || '%';
