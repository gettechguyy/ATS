-- Add separate status and note columns for candidate and recruiter screen outcomes
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS screen_candidate_status text,
  ADD COLUMN IF NOT EXISTS screen_candidate_note text,
  ADD COLUMN IF NOT EXISTS screen_recruiter_status text,
  ADD COLUMN IF NOT EXISTS screen_recruiter_note text;

