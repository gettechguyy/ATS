-- Add interview_questions_url to interviews
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS interview_questions_url text;

