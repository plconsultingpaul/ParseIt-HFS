/*
  # Fix order-entry-pdfs bucket RLS policies

  ## Problem
  The existing policies use `auth.uid()` which requires Supabase Auth.
  This application uses custom authentication, so `auth.uid()` returns NULL
  and all uploads fail with "new row violates row-level security policy".

  ## Changes
  1. Drop existing auth.uid()-based policies
  2. Create public access policies (matching the pdfs bucket pattern)

  ## Security Note
  This is consistent with how the pdfs bucket is configured in this application.
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can upload own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own PDFs" ON storage.objects;

-- Create public access policies for order-entry-pdfs bucket
CREATE POLICY "Allow public inserts to order-entry-pdfs bucket"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'order-entry-pdfs');

CREATE POLICY "Allow public reads from order-entry-pdfs bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'order-entry-pdfs');

CREATE POLICY "Allow public updates to order-entry-pdfs bucket"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'order-entry-pdfs')
WITH CHECK (bucket_id = 'order-entry-pdfs');

CREATE POLICY "Allow public deletes from order-entry-pdfs bucket"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'order-entry-pdfs');