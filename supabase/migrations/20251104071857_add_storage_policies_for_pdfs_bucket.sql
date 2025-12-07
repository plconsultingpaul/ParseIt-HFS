/*
  # Add Storage Policies for PDFs Bucket

  This migration adds the necessary Row Level Security policies for the 'pdfs' storage bucket
  to allow public access (both authenticated and anonymous users) for all operations.

  ## Changes

  1. Storage Policies
    - Add UPDATE policy to allow upsert operations on existing files
    - Add SELECT policy to allow reading/downloading files
    - Add DELETE policy to allow cleanup of temporary files
    - All policies allow public access (authenticated and anonymous users)

  ## Security Notes
  
  - All operations are allowed on the 'pdfs' bucket for public access
  - No special role-based permissions required
  - This allows the upsert functionality to work correctly
*/

-- Allow public updates to pdfs bucket (required for upsert)
CREATE POLICY "Allow public updates to pdfs bucket"
  ON storage.objects
  FOR UPDATE
  TO public
  USING (bucket_id = 'pdfs')
  WITH CHECK (bucket_id = 'pdfs');

-- Allow public reads from pdfs bucket
CREATE POLICY "Allow public reads from pdfs bucket"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'pdfs');

-- Allow public deletes from pdfs bucket (for cleanup operations)
CREATE POLICY "Allow public deletes from pdfs bucket"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'pdfs');
