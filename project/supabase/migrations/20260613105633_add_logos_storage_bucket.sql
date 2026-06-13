-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read
CREATE POLICY "Public read logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'logos');

-- Policy to allow authenticated upload
CREATE POLICY "Authenticated upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Policy to allow authenticated update
CREATE POLICY "Authenticated update logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos');

-- Policy to allow authenticated delete
CREATE POLICY "Authenticated delete logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos');