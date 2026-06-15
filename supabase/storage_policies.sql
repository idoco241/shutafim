-- Storage policies for listing-images bucket
-- Run in: Supabase Dashboard → SQL Editor → New query
-- (Public bucket already allows SELECT without a policy)

CREATE POLICY "Authenticated users can upload listing images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images');

CREATE POLICY "Authenticated users can update listing images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-images');

CREATE POLICY "Authenticated users can delete listing images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images');
