-- Ensure public.offers exists (run in Supabase SQL Editor if you get "table public.offers not found")

-- Create offer_status enum if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_status') THEN
    CREATE TYPE offer_status AS ENUM ('Pending', 'Accepted', 'Declined');
  END IF;
END $$;

-- Create offers table if missing
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  salary numeric,
  status offer_status DEFAULT 'Pending',
  offered_at timestamptz DEFAULT now(),
  CONSTRAINT offers_submission_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE,
  CONSTRAINT offers_candidate_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offers_submission ON public.offers(submission_id);
CREATE INDEX IF NOT EXISTS idx_offers_candidate ON public.offers(candidate_id);

-- RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running (idempotent)
DROP POLICY IF EXISTS "Admin full access offers" ON public.offers;
DROP POLICY IF EXISTS "Recruiter view own offers" ON public.offers;
DROP POLICY IF EXISTS "Recruiter insert offers" ON public.offers;
DROP POLICY IF EXISTS "Recruiter update offers" ON public.offers;
DROP POLICY IF EXISTS "Candidate view own offers" ON public.offers;
DROP POLICY IF EXISTS "Manager view all offers" ON public.offers;

CREATE POLICY "Admin full access offers" ON public.offers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Recruiter view own offers" ON public.offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = offers.submission_id AND s.recruiter_id = auth.uid()));

CREATE POLICY "Recruiter insert offers" ON public.offers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.recruiter_id = auth.uid()));

CREATE POLICY "Recruiter update offers" ON public.offers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = offers.submission_id AND s.recruiter_id = auth.uid()));

CREATE POLICY "Candidate view own offers" ON public.offers FOR SELECT TO authenticated
  USING (public.is_linked_candidate(auth.uid(), candidate_id));

CREATE POLICY "Manager view all offers" ON public.offers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));
