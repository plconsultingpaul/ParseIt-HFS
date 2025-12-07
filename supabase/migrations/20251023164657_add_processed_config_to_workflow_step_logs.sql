/*
  # Add Processed Configuration Tracking to Workflow Step Logs

  1. Changes
    - Add `processed_config` JSONB column to store final processed configuration values after template substitution
    - Add `field_mappings` JSONB column to store the mapping of template placeholders to their resolved values
    - Both columns are nullable to maintain backward compatibility with existing logs
  
  2. Purpose
    - `processed_config`: Stores the final configuration with all template variables replaced with actual values
      - For API calls: contains the final URL, processed request body, etc.
      - For emails: contains final recipient, subject, body with all variables substituted
      - For SFTP: contains final remote path and filename
      - For conditionals: contains the evaluated condition with actual values
    
    - `field_mappings`: Stores the template substitution mapping for debugging
      - Key-value pairs showing what each template variable (e.g., "orders.0.shipper.name") resolved to
      - Helps users understand exactly what data was extracted and used
      - Makes debugging template issues much easier
  
  3. Benefits
    - Complete visibility into template processing for all workflow steps
    - Easy debugging of field extraction and substitution issues
    - Audit trail showing both template and final values
    - No impact on existing functionality or data
*/

-- Add processed_config column to store final processed configuration
ALTER TABLE workflow_step_logs 
ADD COLUMN IF NOT EXISTS processed_config JSONB;

-- Add field_mappings column to store template variable substitutions
ALTER TABLE workflow_step_logs 
ADD COLUMN IF NOT EXISTS field_mappings JSONB;

-- Add comments for documentation
COMMENT ON COLUMN workflow_step_logs.processed_config IS 'Final processed configuration with all template variables substituted with actual values';
COMMENT ON COLUMN workflow_step_logs.field_mappings IS 'Mapping of template placeholders to their resolved values for debugging';
