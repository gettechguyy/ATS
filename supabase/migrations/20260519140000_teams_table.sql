-- Named teams: admin assigns manager, team lead, and recruiters per team.
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  manager_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_lead_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_company_name_unique UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_teams_company_id ON public.teams(company_id);
CREATE INDEX IF NOT EXISTS idx_teams_manager_profile_id ON public.teams(manager_profile_id);
CREATE INDEX IF NOT EXISTS idx_teams_team_lead_profile_id ON public.teams(team_lead_profile_id);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);

COMMENT ON TABLE public.teams IS 'Named recruiting teams within a company';
COMMENT ON COLUMN public.profiles.team_id IS 'Recruiter membership in a named team';
