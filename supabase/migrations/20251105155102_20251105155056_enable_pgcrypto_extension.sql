/*
  # Enable pgcrypto Extension
  
  This migration enables the pgcrypto extension which provides the crypt() and gen_salt()
  functions required for password hashing in the custom authentication system.
  
  ## Changes
  - Enable pgcrypto extension
  
  ## Security
  - Required for password hashing functionality
  - Safe to enable - standard PostgreSQL extension
*/

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;
