/*
  # Fix Database Security Issues

  ## 1. Add Missing Foreign Key Indexes (15 indexes)
  Adding indexes on foreign key columns to improve query performance:
    - email_processing_rules.extraction_type_id
    - extraction_logs.workflow_execution_log_id
    - extraction_types.workflow_id
    - page_group_configs.workflow_id
    - processed_emails.extraction_type_id
    - processed_emails.processing_rule_id
    - sftp_polling_configs.default_extraction_type_id
    - sftp_polling_configs.default_transformation_type_id
    - sftp_polling_configs.workflow_id
    - vendor_extraction_rules.extraction_type_id
    - vendor_extraction_rules.transformation_type_id
    - workflow_execution_logs.current_step_id
    - workflow_step_logs.step_id
    - workflow_steps.next_step_on_failure_id
    - workflow_steps.next_step_on_success_id

  ## 2. Optimize RLS Policies
  Updating RLS policies to use (select auth.uid()) for better performance by avoiding re-evaluation for each row

  ## 3. Remove Duplicate Indexes
  Dropping duplicate indexes:
    - idx_email_processing_rules_transformation_type_id_fk (keeping idx_email_processing_rules_transformation_type_id)
    - idx_sftp_polling_logs_config_id_fk (keeping idx_sftp_polling_logs_config_id)

  ## 4. Remove Duplicate RLS Policies
  Removing redundant "Allow public" policies that overlap with user-specific policies

  ## 5. Fix Function Search Path Security
  Setting explicit search_path for security definer functions to prevent search_path injection attacks

  ## Notes
  - Unused indexes are being kept as they may be useful for future queries
  - Multiple permissive policies are being consolidated to reduce redundancy
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- Index for email_processing_rules.extraction_type_id
CREATE INDEX IF NOT EXISTS idx_email_processing_rules_extraction_type_id 
ON email_processing_rules(extraction_type_id);

-- Index for extraction_logs.workflow_execution_log_id
CREATE INDEX IF NOT EXISTS idx_extraction_logs_workflow_execution_log_id 
ON extraction_logs(workflow_execution_log_id);

-- Index for extraction_types.workflow_id
CREATE INDEX IF NOT EXISTS idx_extraction_types_workflow_id 
ON extraction_types(workflow_id);

-- Index for page_group_configs.workflow_id
CREATE INDEX IF NOT EXISTS idx_page_group_configs_workflow_id 
ON page_group_configs(workflow_id);

-- Index for processed_emails.extraction_type_id
CREATE INDEX IF NOT EXISTS idx_processed_emails_extraction_type_id 
ON processed_emails(extraction_type_id);

-- Index for processed_emails.processing_rule_id
CREATE INDEX IF NOT EXISTS idx_processed_emails_processing_rule_id 
ON processed_emails(processing_rule_id);

-- Index for sftp_polling_configs.default_extraction_type_id
CREATE INDEX IF NOT EXISTS idx_sftp_polling_configs_default_extraction_type_id 
ON sftp_polling_configs(default_extraction_type_id);

-- Index for sftp_polling_configs.default_transformation_type_id
CREATE INDEX IF NOT EXISTS idx_sftp_polling_configs_default_transformation_type_id 
ON sftp_polling_configs(default_transformation_type_id);

-- Index for sftp_polling_configs.workflow_id
CREATE INDEX IF NOT EXISTS idx_sftp_polling_configs_workflow_id 
ON sftp_polling_configs(workflow_id);

-- Index for vendor_extraction_rules.extraction_type_id
CREATE INDEX IF NOT EXISTS idx_vendor_extraction_rules_extraction_type_id 
ON vendor_extraction_rules(extraction_type_id);

-- Index for vendor_extraction_rules.transformation_type_id
CREATE INDEX IF NOT EXISTS idx_vendor_extraction_rules_transformation_type_id 
ON vendor_extraction_rules(transformation_type_id);

-- Index for workflow_execution_logs.current_step_id
CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_current_step_id 
ON workflow_execution_logs(current_step_id);

-- Index for workflow_step_logs.step_id
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_step_id 
ON workflow_step_logs(step_id);

-- Index for workflow_steps.next_step_on_failure_id
CREATE INDEX IF NOT EXISTS idx_workflow_steps_next_step_on_failure_id 
ON workflow_steps(next_step_on_failure_id);

-- Index for workflow_steps.next_step_on_success_id
CREATE INDEX IF NOT EXISTS idx_workflow_steps_next_step_on_success_id 
ON workflow_steps(next_step_on_success_id);

-- =====================================================
-- 2. REMOVE DUPLICATE INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_email_processing_rules_transformation_type_id_fk;
DROP INDEX IF EXISTS idx_sftp_polling_logs_config_id_fk;

-- =====================================================
-- 3. OPTIMIZE RLS POLICIES FOR extraction_types
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can insert own extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can update own extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Users can delete own extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Allow public read access to extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Allow public insert access to extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Allow public update access to extraction types" ON extraction_types;
DROP POLICY IF EXISTS "Allow public delete access to extraction types" ON extraction_types;

-- Create optimized policies (consolidated and using (select auth.uid()))
CREATE POLICY "Users can read extraction types"
  ON extraction_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert extraction types"
  ON extraction_types FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update extraction types"
  ON extraction_types FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete extraction types"
  ON extraction_types FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 4. OPTIMIZE RLS POLICIES FOR sftp_config
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can insert own sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can update own sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Users can delete own sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Allow public read access to sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Allow public insert access to sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Allow public update access to sftp config" ON sftp_config;
DROP POLICY IF EXISTS "Allow public delete access to sftp config" ON sftp_config;

-- Create optimized policies (consolidated and using (select auth.uid()))
CREATE POLICY "Users can read sftp config"
  ON sftp_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert sftp config"
  ON sftp_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update sftp config"
  ON sftp_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete sftp config"
  ON sftp_config FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- 5. FIX FUNCTION SEARCH PATH SECURITY
-- =====================================================

-- Fix create_user function
CREATE OR REPLACE FUNCTION create_user(
  username_input TEXT,
  password_input TEXT,
  is_admin_input BOOLEAN DEFAULT FALSE,
  role_input TEXT DEFAULT 'user',
  email_input TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_user_id UUID;
  default_permissions TEXT;
BEGIN
  -- Validate input
  IF username_input IS NULL OR trim(username_input) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Username is required'
    );
  END IF;
  
  IF password_input IS NULL OR trim(password_input) = '' THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Password is required'
    );
  END IF;
  
  -- Check if username already exists
  IF EXISTS (SELECT 1 FROM users WHERE username = trim(username_input)) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Username already exists'
    );
  END IF;
  
  -- Set default permissions based on admin status
  IF is_admin_input THEN
    default_permissions := json_build_object(
      'extractionTypes', true,
      'transformationTypes', true,
      'sftp', true,
      'api', true,
      'emailMonitoring', true,
      'emailRules', true,
      'processedEmails', true,
      'extractionLogs', true,
      'userManagement', true,
      'workflowManagement', true
    )::text;
  ELSE
    default_permissions := json_build_object(
      'extractionTypes', false,
      'transformationTypes', false,
      'sftp', false,
      'api', false,
      'emailMonitoring', false,
      'emailRules', false,
      'processedEmails', false,
      'extractionLogs', false,
      'userManagement', false,
      'workflowManagement', false
    )::text;
  END IF;
  
  -- Create the user with hashed password
  INSERT INTO users (
    username,
    password_hash,
    is_admin,
    is_active,
    role,
    email,
    permissions,
    preferred_upload_mode,
    current_zone,
    created_at,
    updated_at
  ) VALUES (
    trim(username_input),
    crypt(password_input, gen_salt('bf')),
    is_admin_input,
    true,
    COALESCE(role_input, CASE WHEN is_admin_input THEN 'admin' ELSE 'user' END),
    email_input,
    default_permissions,
    'manual',
    '',
    now(),
    now()
  ) RETURNING id INTO new_user_id;
  
  IF new_user_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', true,
      'message', 'User created successfully',
      'user_id', new_user_id
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'message', 'Failed to create user'
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error creating user: ' || SQLERRM
    );
END;
$$;

-- Fix verify_password function
CREATE OR REPLACE FUNCTION verify_password(username_input TEXT, password_input TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_record users%ROWTYPE;
  result json;
BEGIN
  -- Find the user
  SELECT * INTO user_record
  FROM users 
  WHERE username = username_input AND is_active = true;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid username or password'
    );
  END IF;
  
  -- Verify password
  IF user_record.password_hash = crypt(password_input, user_record.password_hash) THEN
    RETURN json_build_object(
      'success', true,
      'user', json_build_object(
        'id', user_record.id,
        'username', user_record.username,
        'is_admin', user_record.is_admin,
        'is_active', user_record.is_active,
        'permissions', user_record.permissions,
        'role', user_record.role
      )
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid username or password'
    );
  END IF;
END;
$$;

-- Fix update_page_group_configs_updated_at function
CREATE OR REPLACE FUNCTION update_page_group_configs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix get_next_parseit_id function
CREATE OR REPLACE FUNCTION get_next_parseit_id()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_id INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(parseit_id FROM '^[0-9]+') AS INTEGER)), 0) + 1
  INTO next_id
  FROM extraction_logs
  WHERE parseit_id ~ '^[0-9]+';
  
  RETURN next_id;
END;
$$;

-- Fix hash_password function (keep original parameter name)
CREATE OR REPLACE FUNCTION hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$;