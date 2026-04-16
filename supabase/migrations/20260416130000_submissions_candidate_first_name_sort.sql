-- PostgREST/Supabase: ORDER BY on embedded `candidates.first_name_sort` does not reliably
-- order parent `submissions` rows. Denormalize sort key onto submissions for correct A–Z paging.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS candidate_first_name_sort text;

UPDATE public.submissions s
SET candidate_first_name_sort = c.first_name_sort
FROM public.candidates c
WHERE c.id = s.candidate_id;

CREATE INDEX IF NOT EXISTS idx_submissions_candidate_first_name_sort
  ON public.submissions (candidate_first_name_sort);

CREATE OR REPLACE FUNCTION public.submissions_set_candidate_first_name_sort()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.candidate_id IS NULL THEN
    NEW.candidate_first_name_sort := NULL;
  ELSE
    SELECT c.first_name_sort INTO NEW.candidate_first_name_sort
    FROM public.candidates c
    WHERE c.id = NEW.candidate_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_set_candidate_first_name_sort ON public.submissions;
CREATE TRIGGER trg_submissions_set_candidate_first_name_sort
  BEFORE INSERT OR UPDATE OF candidate_id ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.submissions_set_candidate_first_name_sort();

CREATE OR REPLACE FUNCTION public.candidates_refresh_submissions_candidate_first_name_sort()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.first_name_sort IS DISTINCT FROM NEW.first_name_sort THEN
    UPDATE public.submissions
    SET candidate_first_name_sort = NEW.first_name_sort
    WHERE candidate_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidates_refresh_submissions_candidate_first_name_sort ON public.candidates;
CREATE TRIGGER trg_candidates_refresh_submissions_candidate_first_name_sort
  AFTER UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.candidates_refresh_submissions_candidate_first_name_sort();
