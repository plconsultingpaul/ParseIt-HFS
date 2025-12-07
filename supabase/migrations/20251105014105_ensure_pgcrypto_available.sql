/*
  # Ensure pgcrypto Extension is Available

  ## Summary
  This migration ensures the pgcrypto extension functions (crypt, gen_salt) are accessible
  for password hashing operations.

  ## Changes Made
  1. **Create Extension in Public Schema**
     - Creates pgcrypto extension if not already in public schema
     - This makes crypt() and gen_salt() functions available without schema qualification

  ## Notes
  - pgcrypto is needed for bcrypt password hashing
  - The extension is safe to create multiple times (IF NOT EXISTS)
*/

-- Create pgcrypto extension in public schema if it doesn't exist there
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
