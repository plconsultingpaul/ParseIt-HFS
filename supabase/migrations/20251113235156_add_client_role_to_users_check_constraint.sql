/*
  # Fix Role Check Constraint to Support Client Role
  
  1. Changes
    - Drop existing users_role_check constraint
    - Add new constraint that includes 'client' role
    - Valid roles: 'admin', 'user', 'vendor', 'client'
  
  2. Security
    - Maintains existing RLS policies
    - No data changes required
*/

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add the updated constraint with 'client' role included
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'user', 'vendor', 'client'));
