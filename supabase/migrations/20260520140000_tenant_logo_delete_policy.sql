-- Allow anon to delete tenant logos from storage (custom auth)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anon can delete tenant logos'
  ) THEN
    CREATE POLICY "Anon can delete tenant logos"
    ON storage.objects FOR DELETE TO anon
    USING (bucket_id IN ('ATSDocs', 'documents') AND (storage.foldername(name))[1] = 'logo');
  END IF;
END $$;
