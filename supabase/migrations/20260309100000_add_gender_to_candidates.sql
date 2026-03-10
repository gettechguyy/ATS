-- Add gender column to candidates for admin and candidate to edit (insert if not exists)
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS gender text;

COMMENT ON COLUMN public.candidates.gender IS 'Candidate gender; editable by admin and by the candidate (own profile).';
