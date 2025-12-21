/*
  # Fix Track & Trace RLS Policies

  This migration fixes the RLS policies for track_trace tables to use
  the `public` role instead of `authenticated`, matching the pattern
  used by other tables in this application which uses custom authentication.

  ## Tables Affected
    - track_trace_configs
    - track_trace_fields
    - track_trace_templates
    - track_trace_template_fields

  ## Changes
    - Drop all existing policies using `authenticated` and `anon` roles
    - Create new policies using `public` role for full access
*/

-- ============================================
-- track_trace_configs
-- ============================================
DROP POLICY IF EXISTS "Admins can manage track trace configs" ON track_trace_configs;
DROP POLICY IF EXISTS "Client users can read their own track trace config" ON track_trace_configs;
DROP POLICY IF EXISTS "Anon can read track trace configs for client portal" ON track_trace_configs;

CREATE POLICY "Allow public read access to track_trace_configs"
  ON track_trace_configs FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to track_trace_configs"
  ON track_trace_configs FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_configs"
  ON track_trace_configs FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_configs"
  ON track_trace_configs FOR DELETE TO public USING (true);

-- ============================================
-- track_trace_fields
-- ============================================
DROP POLICY IF EXISTS "Admins can manage track trace fields" ON track_trace_fields;
DROP POLICY IF EXISTS "Client users can read their own track trace fields" ON track_trace_fields;
DROP POLICY IF EXISTS "Anon can read track trace fields for client portal" ON track_trace_fields;

CREATE POLICY "Allow public read access to track_trace_fields"
  ON track_trace_fields FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to track_trace_fields"
  ON track_trace_fields FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_fields"
  ON track_trace_fields FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_fields"
  ON track_trace_fields FOR DELETE TO public USING (true);

-- ============================================
-- track_trace_templates
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view templates" ON track_trace_templates;
DROP POLICY IF EXISTS "Authenticated users can insert templates" ON track_trace_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON track_trace_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON track_trace_templates;
DROP POLICY IF EXISTS "Anon users can view active templates" ON track_trace_templates;

CREATE POLICY "Allow public read access to track_trace_templates"
  ON track_trace_templates FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to track_trace_templates"
  ON track_trace_templates FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_templates"
  ON track_trace_templates FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_templates"
  ON track_trace_templates FOR DELETE TO public USING (true);

-- ============================================
-- track_trace_template_fields
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view template fields" ON track_trace_template_fields;
DROP POLICY IF EXISTS "Authenticated users can insert template fields" ON track_trace_template_fields;
DROP POLICY IF EXISTS "Authenticated users can update template fields" ON track_trace_template_fields;
DROP POLICY IF EXISTS "Authenticated users can delete template fields" ON track_trace_template_fields;
DROP POLICY IF EXISTS "Anon users can view fields of active templates" ON track_trace_template_fields;

CREATE POLICY "Allow public read access to track_trace_template_fields"
  ON track_trace_template_fields FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to track_trace_template_fields"
  ON track_trace_template_fields FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update access to track_trace_template_fields"
  ON track_trace_template_fields FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete access to track_trace_template_fields"
  ON track_trace_template_fields FOR DELETE TO public USING (true);