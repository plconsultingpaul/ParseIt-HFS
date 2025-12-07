/*
  # Fix Clients Table RLS Policies

  1. Changes
    - Drop existing RLS policies that use auth.uid() (incompatible with custom authentication)
    - Add standard public access policy used throughout the application
    
  2. Security
    - Replaces auth.uid() pattern with application's standard public access pattern
    - Maintains consistency with other tables (user_extraction_types, user_transformation_types, etc.)
    - Authentication is handled at the application layer in React components
    
  3. Notes
    - This fix mirrors the pattern used in migrations 20251113053839 and 20251113063207
    - The application handles authentication via custom username/password system
    - Authorization checks (e.g., isAdmin) are performed in the React layer before database operations
*/

-- Drop existing policies that use auth.uid()
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;
DROP POLICY IF EXISTS "Client users can read own client data" ON clients;

-- Add standard public access policy
CREATE POLICY "Enable all access for clients"
  ON clients
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
