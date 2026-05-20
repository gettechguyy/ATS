-- Org hierarchy on profiles: Manager → Team Lead → Recruiter (within company)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_lead_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_manager_profile_id ON public.profiles(manager_profile_id);
CREATE INDEX IF NOT EXISTS idx_profiles_team_lead_profile_id ON public.profiles(team_lead_profile_id);

COMMENT ON COLUMN public.profiles.manager_profile_id IS 'For team_lead users: their manager profile id';
COMMENT ON COLUMN public.profiles.team_lead_profile_id IS 'For recruiter users: their team lead profile id';
