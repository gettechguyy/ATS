-- Add 'Vendor Responded' status and extra submission fields
-- Place 'Vendor Responded' right after 'Applied'
ALTER TYPE submission_status ADD VALUE IF NOT EXISTS 'Vendor Responded' AFTER 'Applied';

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS rate numeric,
  ADD COLUMN IF NOT EXISTS rate_type text,
  ADD COLUMN IF NOT EXISTS job_description text,
  ADD COLUMN IF NOT EXISTS job_type text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

-- Screen call related fields
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS screen_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS screen_mode text,
  ADD COLUMN IF NOT EXISTS screen_link_or_phone text,
  ADD COLUMN IF NOT EXISTS screen_resume_url text,
  ADD COLUMN IF NOT EXISTS screen_questions_url text,
  ADD COLUMN IF NOT EXISTS screen_response_status text,
  ADD COLUMN IF NOT EXISTS screen_rejection_note text,
  ADD COLUMN IF NOT EXISTS screen_next_step text;

