-- Ensure fk_profiles_linked_candidate uses ON DELETE SET NULL to avoid FK violations
-- Drops existing constraint (if any) and recreates with ON DELETE SET NULL

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_linked_candidate;

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_linked_candidate
  FOREIGN KEY (linked_candidate_id) REFERENCES public.candidates(id) ON DELETE SET NULL;

-- Grant safety: ensure column allows nulls
ALTER TABLE public.profiles ALTER COLUMN linked_candidate_id DROP NOT NULL;

