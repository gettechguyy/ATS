-- Fix logo not persisting/displaying: ensure DB access + storage policies for anon (custom auth)

ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies DISABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.companies TO anon, authenticated;
GRANT SELECT, UPDATE ON public.agencies TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anon can upload tenant logos'
  ) THEN
    CREATE POLICY "Anon can upload tenant logos"
    ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id IN ('ATSDocs', 'documents') AND (storage.foldername(name))[1] = 'logo');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anon can update tenant logos'
  ) THEN
    CREATE POLICY "Anon can update tenant logos"
    ON storage.objects FOR UPDATE TO anon
    USING (bucket_id IN ('ATSDocs', 'documents') AND (storage.foldername(name))[1] = 'logo');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anon can read tenant logos'
  ) THEN
    CREATE POLICY "Anon can read tenant logos"
    ON storage.objects FOR SELECT TO anon
    USING (bucket_id IN ('ATSDocs', 'documents') AND (storage.foldername(name))[1] = 'logo');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Anon can delete tenant logos'
  ) THEN
    CREATE POLICY "Anon can delete tenant logos"
    ON storage.objects FOR DELETE TO anon
    USING (bucket_id IN ('ATSDocs', 'documents') AND (storage.foldername(name))[1] = 'logo');
  END IF;
END $$;
