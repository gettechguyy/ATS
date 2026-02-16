-- Add job description fields to offers
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS job_description text,
  ADD COLUMN IF NOT EXISTS job_description_url text;

