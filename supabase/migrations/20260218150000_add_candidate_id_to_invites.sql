-- Add candidate_id to invites so invites can be linked to an existing candidate row
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.candidates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invites_candidate_id ON invites(candidate_id);

