/*
  # Add User Transformation Types Junction Table

  1. New Table
    - `user_transformation_types`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `transformation_type_id` (uuid, foreign key to transformation_types)
      - `created_at` (timestamptz)
      - Unique constraint on (user_id, transformation_type_id)

  2. Indexes
    - Index on user_id for fast lookups by user
    - Index on transformation_type_id for fast lookups by type

  3. Security
    - Enable RLS on user_transformation_types table
    - Users can read their own transformation type assignments
    - Admins can manage all transformation type assignments
*/

-- Create user_transformation_types junction table
CREATE TABLE IF NOT EXISTS user_transformation_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transformation_type_id uuid NOT NULL REFERENCES transformation_types(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, transformation_type_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_transformation_types_user_id ON user_transformation_types(user_id);
CREATE INDEX IF NOT EXISTS idx_user_transformation_types_transformation_type_id ON user_transformation_types(transformation_type_id);

-- Enable RLS
ALTER TABLE user_transformation_types ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own transformation type assignments
CREATE POLICY "Users can read own transformation type assignments"
  ON user_transformation_types
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policy: Admins can manage all transformation type assignments
CREATE POLICY "Admins can manage all transformation type assignments"
  ON user_transformation_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.is_admin = true
    )
  );