/*
  # Add INSERT policy for pdfs storage bucket

  1. Changes
    - Add INSERT policy to allow uploading files to the 'pdfs' storage bucket
    - Allows public access for uploading (authenticated and anonymous users)
  
  2. Security Notes
    - This allows logo uploads and other file uploads to work correctly
    - All uploads are allowed on the 'pdfs' bucket for public access
*/

-- Allow public inserts to pdfs bucket (required for uploads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public inserts to pdfs bucket'
  ) THEN
    CREATE POLICY "Allow public inserts to pdfs bucket"
      ON storage.objects
      FOR INSERT
      TO public
      WITH CHECK (bucket_id = 'pdfs');
  END IF;
END $$;