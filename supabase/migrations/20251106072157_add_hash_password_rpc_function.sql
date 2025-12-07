/*
  # Add hash_password RPC Function
  
  ## Summary
  This migration adds the missing hash_password RPC function that the frontend
  requires for updating vendor passwords. The function was removed in previous
  migrations but is still called by the frontend code.
  
  ## Changes Made
  1. **Create hash_password function**
     - Takes password text parameter
     - Returns bcrypt hash using extensions.crypt()
     - Uses extensions.gen_salt('bf') for bcrypt salt generation
     - SECURITY DEFINER with proper search_path
  
  ## Notes
  - This function is called via supabase.rpc('hash_password') from the frontend
  - Uses the same bcrypt approach as other password functions for consistency
  - Required for vendor password update functionality
*/

-- Add hash_password RPC function for frontend password updates
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  -- Use bcrypt hashing via pgcrypto extension
  RETURN extensions.crypt(password, extensions.gen_salt('bf'));
END;
$$;