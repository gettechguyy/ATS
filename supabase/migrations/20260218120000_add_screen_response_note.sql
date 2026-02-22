-- Add screen_response_note column to submissions table
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS screen_response_note text;

-- Optional: ensure screen_response_status column exists (text) — no-op if already present
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS screen_response_status text;

