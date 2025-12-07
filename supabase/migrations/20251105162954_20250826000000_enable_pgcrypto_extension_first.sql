/*
  # Enable pgcrypto Extension - CRITICAL FIRST MIGRATION
  
  This migration enables the pgcrypto extension which provides the crypt() and gen_salt()
  functions required for password hashing throughout the application.
  
  ## CRITICAL IMPORTANCE
  This migration MUST run before any other migration that uses password hashing functions.
  The timestamp 20250826000000 ensures this runs before all other migrations in the system.
  
  ## Changes
  - Enable pgcrypto extension
  
  ## Security
  - Required for all password hashing functionality
  - Standard PostgreSQL extension - safe to enable
  - Provides crypt() and gen_salt() functions
*/

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
