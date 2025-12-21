/*
  # Password Reset System

  1. New Tables
    - `password_reset_tokens`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `token` (uuid, unique)
      - `expires_at` (timestamptz)
      - `used_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
    
    - `password_reset_templates`
      - `id` (uuid, primary key)
      - `template_type` (text) - 'admin_forgot_username', 'admin_reset_password', 'client_forgot_username', 'client_reset_password'
      - `subject` (text)
      - `body` (text) - HTML content
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated access
*/

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create password reset templates table
CREATE TABLE IF NOT EXISTS password_reset_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text UNIQUE NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Enable RLS
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for password_reset_tokens (public access for token validation)
CREATE POLICY "Public can validate tokens"
  ON password_reset_tokens FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can create tokens"
  ON password_reset_tokens FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "System can update tokens"
  ON password_reset_tokens FOR UPDATE
  TO public
  USING (true);

-- RLS Policies for password_reset_templates (public read for sending emails, authenticated write)
CREATE POLICY "Public can read templates"
  ON password_reset_templates FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated can insert templates"
  ON password_reset_templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update templates"
  ON password_reset_templates FOR UPDATE
  TO authenticated
  USING (true);

-- Insert default templates
INSERT INTO password_reset_templates (template_type, subject, body) VALUES
(
  'admin_forgot_username',
  'Your Username - Parse-It',
  '<html><body><h2>Username Recovery</h2><p>Your username is: <strong>{{username}}</strong></p><p>You can use this username to log in to your admin account.</p></body></html>'
),
(
  'admin_reset_password',
  'Reset Your Password - Parse-It',
  '<html><body><h2>Password Reset Request</h2><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>This link will expire in 1 hour.</p><p>If you did not request this reset, please ignore this email.</p></body></html>'
),
(
  'client_forgot_username',
  'Your Username - FreightHub',
  '<html><body><h2>Username Recovery</h2><p>Your username is: <strong>{{username}}</strong></p><p>You can use this username to log in to your client account.</p></body></html>'
),
(
  'client_reset_password',
  'Reset Your Password - FreightHub',
  '<html><body><h2>Password Reset Request</h2><p>Click the link below to reset your password:</p><p><a href="{{reset_link}}">Reset Password</a></p><p>This link will expire in 1 hour.</p><p>If you did not request this reset, please ignore this email.</p></body></html>'
)
ON CONFLICT (template_type) DO NOTHING;