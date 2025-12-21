/*
  # Fix Email Processing Rules RLS Policies

  1. Problem
    - The email_processing_rules table has RLS policy for 'authenticated' role
    - This project uses custom authentication, requiring 'public' role policies
    - Users cannot insert/update/delete email processing rules

  2. Changes
    - Drop existing 'email_processing_rules_all_access' policy (authenticated)
    - Add 4 new policies for 'public' role matching extraction_types pattern:
      - SELECT: Allow public read access
      - INSERT: Allow public insert access
      - UPDATE: Allow public update access
      - DELETE: Allow public delete access

  3. Security
    - Policies match the existing pattern used by extraction_types and transformation_types
    - Uses custom authentication at application level
*/

DROP POLICY IF EXISTS "email_processing_rules_all_access" ON email_processing_rules;

CREATE POLICY "Allow public read access to email processing rules"
  ON email_processing_rules
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to email processing rules"
  ON email_processing_rules
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to email processing rules"
  ON email_processing_rules
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to email processing rules"
  ON email_processing_rules
  FOR DELETE
  TO public
  USING (true);
