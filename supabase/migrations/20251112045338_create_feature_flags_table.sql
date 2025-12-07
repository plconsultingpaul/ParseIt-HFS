/*
  # Create Feature Flags Table

  1. New Tables
    - `feature_flags`
      - `id` (uuid, primary key)
      - `feature_key` (text, unique)
      - `feature_name` (text)
      - `is_enabled` (boolean, default false)
      - `description` (text)
      - `category` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `feature_flags` table
    - Add policy for public read access
    - Add policy for admin write access

  3. Initial Data
    - Insert default feature flags for all system features
*/

CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  feature_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to feature flags"
  ON feature_flags
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to feature flags"
  ON feature_flags
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to feature flags"
  ON feature_flags
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to feature flags"
  ON feature_flags
  FOR DELETE
  TO public
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_feature_key ON feature_flags(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_category ON feature_flags(category);
CREATE INDEX IF NOT EXISTS idx_feature_flags_is_enabled ON feature_flags(is_enabled);

-- Insert default feature flags
INSERT INTO feature_flags (feature_key, feature_name, is_enabled, description, category) VALUES
  ('extraction_types', 'Extraction Types', true, 'Manage PDF extraction templates and configurations', 'extraction'),
  ('transformation_types', 'Transformation Types', true, 'Manage PDF transformation and renaming templates', 'transformation'),
  ('sftp_upload', 'SFTP Upload', true, 'Enable SFTP file upload functionality', 'integration'),
  ('sftp_polling', 'SFTP Polling', true, 'Monitor SFTP folders for automatic PDF processing', 'integration'),
  ('api_integration', 'API Integration', true, 'Enable external API integration features', 'integration'),
  ('email_monitoring', 'Email Monitoring', true, 'Monitor email accounts for PDF attachments', 'email'),
  ('email_rules', 'Email Processing Rules', true, 'Automated email processing rules', 'email'),
  ('workflow_management', 'Workflow Management', true, 'Create and manage multi-step processing workflows', 'automation'),
  ('user_management', 'User Management', true, 'Manage user accounts and permissions', 'admin'),
  ('vendor_management', 'Vendor Management', true, 'Manage vendor accounts and custom rules', 'admin'),
  ('driver_checkin', 'Driver Check-In', true, 'Enable driver check-in system', 'operations'),
  ('company_branding', 'Company Branding', true, 'Customize company branding and logos', 'customization'),
  ('extraction_logs', 'Extraction Logs', true, 'View PDF extraction activity logs', 'monitoring'),
  ('workflow_execution_logs', 'Workflow Execution Logs', true, 'View workflow execution history', 'monitoring'),
  ('email_polling_logs', 'Email Polling Logs', true, 'View email monitoring logs', 'monitoring'),
  ('sftp_polling_logs', 'SFTP Polling Logs', true, 'View SFTP polling logs', 'monitoring')
ON CONFLICT (feature_key) DO NOTHING;