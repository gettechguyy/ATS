-- Tenant branding: logo URL on companies and agencies (files live in storage at logo/{id}/...)

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.companies.logo_url IS 'Public URL for company logo (storage path logo/{company_id}/...)';
COMMENT ON COLUMN public.agencies.logo_url IS 'Public URL for agency logo (storage path logo/{agency_id}/...)';

-- Custom auth uses anon key; allow read/update of branding (same pattern as other app tables)
ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies DISABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.companies TO anon, authenticated;
GRANT SELECT, UPDATE ON public.agencies TO anon, authenticated;

-- Allow anon uploads/updates for tenant logos in storage (bucket name must match VITE_SUPABASE_BUCKET)
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
END $$;
