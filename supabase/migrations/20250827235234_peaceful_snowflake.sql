/*
  # Create get_next_parseit_id function

  1. New Functions
    - `get_next_parseit_id()` - Returns the next available ParseIt ID by finding the highest existing ID and adding 1

  2. Security
    - Function is accessible to authenticated users and service role
    - Uses SECURITY DEFINER to ensure consistent access
*/

CREATE OR REPLACE FUNCTION get_next_parseit_id()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    next_id INTEGER;
BEGIN
    -- Get the highest parseit_id from processed_emails and add 1
    SELECT COALESCE(MAX(parseit_id), 0) + 1 
    INTO next_id 
    FROM processed_emails 
    WHERE parseit_id IS NOT NULL;
    
    -- If no records exist, start from 1
    IF next_id IS NULL THEN
        next_id := 1;
    END IF;
    
    RETURN next_id;
END;
$$;