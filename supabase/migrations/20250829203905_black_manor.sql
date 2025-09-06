/*
  # Create ParseIt ID sequence and function

  1. New Sequence
    - `parseit_id_seq` - Auto-incrementing sequence starting at 1
  
  2. New Function
    - `get_next_parseit_id()` - Returns next value from sequence
    
  3. Security
    - Public access to the function for API calls
*/

-- Create sequence for ParseIt IDs
CREATE SEQUENCE IF NOT EXISTS parseit_id_seq START 1;

-- Create function to get next ParseIt ID
CREATE OR REPLACE FUNCTION get_next_parseit_id()
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT nextval('parseit_id_seq')::INTEGER;
$$;

-- Grant execute permission to public (for API calls)
GRANT EXECUTE ON FUNCTION get_next_parseit_id() TO public;