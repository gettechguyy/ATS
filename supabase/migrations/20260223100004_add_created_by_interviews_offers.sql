-- Add created_by to interviews and offers so recruiters can query directly
-- without joining through submissions (faster fetches, simpler code).

-- INTERVIEWS: add created_by (recruiter who owns the submission; same as submissions.recruiter_id)
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill from submissions
UPDATE public.interviews i
SET created_by = s.recruiter_id
FROM public.submissions s
WHERE s.id = i.submission_id AND i.created_by IS NULL;

-- Index for recruiter-scoped queries
CREATE INDEX IF NOT EXISTS idx_interviews_created_by ON public.interviews(created_by);

-- OFFERS: add created_by (recruiter who owns the submission; same as submissions.recruiter_id)
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill from submissions
UPDATE public.offers o
SET created_by = s.recruiter_id
FROM public.submissions s
WHERE s.id = o.submission_id AND o.created_by IS NULL;

-- Index for recruiter-scoped queries
CREATE INDEX IF NOT EXISTS idx_offers_created_by ON public.offers(created_by);

-- Optional: make created_by NOT NULL for new rows (keep nullable for legacy rows without recruiter)
-- We keep it nullable so old rows without recruiter_id on submission still work.

-- ============================================
-- RLS: Use created_by for recruiter policies (faster than JOIN to submissions)
-- ============================================

-- INTERVIEWS: drop old recruiter policies and recreate using created_by
DROP POLICY IF EXISTS "Recruiter view own interviews" ON public.interviews;
DROP POLICY IF EXISTS "Recruiter insert interviews" ON public.interviews;
DROP POLICY IF EXISTS "Recruiter update interviews" ON public.interviews;

CREATE POLICY "Recruiter view own interviews" ON public.interviews FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM submissions s WHERE s.id = interviews.submission_id AND s.recruiter_id = auth.uid())
  );
CREATE POLICY "Recruiter insert interviews" ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_id AND s.recruiter_id = auth.uid())
  );
CREATE POLICY "Recruiter update interviews" ON public.interviews FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM submissions s WHERE s.id = interviews.submission_id AND s.recruiter_id = auth.uid())
  );

-- OFFERS: drop old recruiter policies and recreate using created_by
DROP POLICY IF EXISTS "Recruiter view own offers" ON public.offers;
DROP POLICY IF EXISTS "Recruiter insert offers" ON public.offers;

CREATE POLICY "Recruiter view own offers" ON public.offers FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM submissions s WHERE s.id = offers.submission_id AND s.recruiter_id = auth.uid())
  );
CREATE POLICY "Recruiter insert offers" ON public.offers FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_id AND s.recruiter_id = auth.uid())
  );
