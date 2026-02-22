-- Add team_lead_id to candidates to support hierarchical assignment
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS team_lead_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

