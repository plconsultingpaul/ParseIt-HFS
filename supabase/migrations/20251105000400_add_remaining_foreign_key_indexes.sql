/*
  # Add Remaining Foreign Key Indexes

  ## Changes
  
  Adding indexes to the last 2 foreign key columns identified:
  - email_processing_rules.transformation_type_id
  - sftp_polling_logs.config_id
  
  These indexes will improve query performance for joins and foreign key constraint checks.

  ## Note on "Unused Indexes"
  
  The security scanner shows the previously created indexes as "unused" because:
  1. They were just created and haven't been used by queries yet
  2. Index usage statistics take time to accumulate
  3. Foreign key indexes are critical for performance even if not immediately showing usage
  
  These indexes should NOT be dropped as they are essential for:
  - Foreign key constraint validation performance
  - JOIN operations on these columns
  - Preventing table locks during FK checks
*/

-- Add index for email_processing_rules.transformation_type_id foreign key
CREATE INDEX IF NOT EXISTS idx_email_processing_rules_transformation_type_id_fk
  ON public.email_processing_rules(transformation_type_id);

-- Add index for sftp_polling_logs.config_id foreign key
CREATE INDEX IF NOT EXISTS idx_sftp_polling_logs_config_id_fk
  ON public.sftp_polling_logs(config_id);
