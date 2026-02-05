/*
  # Add Execute Permissions System

  1. New Columns
    - `users.has_execute_setup_access` (boolean, default false)
      - Controls access to the admin Execute Setup settings page

  2. New Tables
    - `user_execute_category_access`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `category_id` (uuid, foreign key to execute_button_categories)
      - `created_at` (timestamptz)
      - Unique constraint on (user_id, category_id)
      - Junction table that defines which categories each user can access

  3. Security
    - Enable RLS on new table
    - Add policies for public access (matches existing pattern)

  4. Notes
    - This enables category-level permissions for Execute buttons
    - Users will only see buttons from categories they have access to
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'has_execute_setup_access'
  ) THEN
    ALTER TABLE users ADD COLUMN has_execute_setup_access boolean DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_execute_category_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES execute_button_categories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_user_execute_category_access_user_id 
  ON user_execute_category_access(user_id);

CREATE INDEX IF NOT EXISTS idx_user_execute_category_access_category_id 
  ON user_execute_category_access(category_id);

ALTER TABLE user_execute_category_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to user_execute_category_access"
  ON user_execute_category_access FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow public insert access to user_execute_category_access"
  ON user_execute_category_access FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow public update access to user_execute_category_access"
  ON user_execute_category_access FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to user_execute_category_access"
  ON user_execute_category_access FOR DELETE
  TO anon, authenticated
  USING (true);
