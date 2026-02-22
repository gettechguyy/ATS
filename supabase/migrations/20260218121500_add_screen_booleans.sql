-- Add boolean columns to track who marked screen calls
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS screen_candidate_attended boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS screen_recruiter_done boolean DEFAULT false;

