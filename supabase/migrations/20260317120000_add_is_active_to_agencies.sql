-- Add is_active flag to agencies so admin can enable/disable agency logins

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

