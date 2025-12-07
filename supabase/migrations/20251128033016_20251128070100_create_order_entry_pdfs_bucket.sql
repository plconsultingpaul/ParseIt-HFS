/*
  # Create Storage Bucket for Order Entry PDFs

  1. Storage
    - Create order-entry-pdfs bucket with public read access
    - Add storage policies for authenticated users

  2. Security
    - Users can upload their own PDFs
    - Users can read their own PDFs
    - Users can update their own PDFs
    - Users can delete their own PDFs
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('order-entry-pdfs', 'order-entry-pdfs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order-entry-pdfs' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'order-entry-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'order-entry-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order-entry-pdfs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
