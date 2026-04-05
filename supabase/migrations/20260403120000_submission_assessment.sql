-- Assessment stage: after Vendor Responded, before Screen Call
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'Assessment' AFTER 'Vendor Responded';

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS assessment_end_date date NULL,
  ADD COLUMN IF NOT EXISTS assessment_link text NULL,
  ADD COLUMN IF NOT EXISTS assessment_attachment_url text NULL;
