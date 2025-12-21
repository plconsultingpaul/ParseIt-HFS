/*
  # Fix Track & Trace Template Default Fields RLS Policies

  This migration fixes the RLS policies for track_trace_template_default_fields
  to use the `public` role instead of `authenticated`/`anon`, matching the pattern
  used by other tables in this application which uses custom authentication.

  ## Changes
    - Drop existing policies using `authenticated` and `anon` roles
    - Create new policies using `public` role for full access
*/

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Authenticated users can view default fields" ON track_trace_template_default_fields;
DROP POLICY IF EXISTS "Authenticated users can insert default fields" ON track_trace_template_default_fields;
DROP POLICY IF EXISTS "Authenticated users can update default fields" ON track_trace_template_default_fields;
DROP POLICY IF EXISTS "Authenticated users can delete default fields" ON track_trace_template_default_fields;
DROP POLICY IF EXISTS "Anon users can view default fields of active templates" ON track_trace_template_default_fields;

-- Create correct policies using public role
CREATE POLICY "Allow public read access to track_trace_template_default_fields"
  ON track_trace_template_default_fields FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to track_trace_template_default_fields"
  ON track_trace_template_default_fields FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_template_default_fields"
  ON track_trace_template_default_fields FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_template_default_fields"
  ON track_trace_template_default_fields FOR DELETE TO public USING (true);
