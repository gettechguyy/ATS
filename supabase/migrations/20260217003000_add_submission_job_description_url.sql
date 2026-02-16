-- Add job_description_url to submissions for uploaded vendor job descriptions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS job_description_url text;

