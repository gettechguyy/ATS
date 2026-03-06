-- ============================================
-- OUT MARKETING AGENCY SCOPE – Required schema
-- ============================================
-- Tables/columns added:
--   1. Table: public.agencies (id uuid PK, name text, type text CHECK in/out, created_at timestamptz)
--   2. Enum: app_role + value 'agency_admin'
--   3. profiles.agency_id (uuid FK → agencies.id ON DELETE SET NULL)
--   4. candidates.agency_id (uuid FK → agencies.id ON DELETE SET NULL)
--   5. Indexes: idx_candidates_agency_id, idx_profiles_agency_id
-- Master company (Thetechguyy) has no agency; out agencies are created by master admin.
-- ============================================

CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'out' CHECK (type IN ('in', 'out')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add agency_admin to app_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'agency_admin') THEN
    ALTER TYPE app_role ADD VALUE 'agency_admin';
  END IF;
END$$;

-- Profiles: agency_id = which agency this user belongs to (NULL = master company)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

-- Candidates: agency_id = which agency this candidate is assigned to (set by master admin)
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES public.agencies(id) ON DELETE SET NULL;

-- Index for filtering candidates by agency
CREATE INDEX IF NOT EXISTS idx_candidates_agency_id ON public.candidates(agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON public.profiles(agency_id);
