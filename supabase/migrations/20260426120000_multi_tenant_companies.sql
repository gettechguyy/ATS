-- Multi-tenant: companies table, company_id on core entities, backfill to Thetechguyy, RPCs.

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_slug_key UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies (slug);

-- Default tenant (existing production data)
INSERT INTO public.companies (name, slug)
VALUES ('Thetechguyy', 'thetechguyy')
ON CONFLICT (slug) DO NOTHING;

-- Add nullable company_id columns first
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_agencies_company_id ON public.agencies(company_id);
CREATE INDEX IF NOT EXISTS idx_candidates_company_id ON public.candidates(company_id);
CREATE INDEX IF NOT EXISTS idx_submissions_company_id ON public.submissions(company_id);
CREATE INDEX IF NOT EXISTS idx_interviews_company_id ON public.interviews(company_id);
CREATE INDEX IF NOT EXISTS idx_offers_company_id ON public.offers(company_id);
CREATE INDEX IF NOT EXISTS idx_invites_company_id ON public.invites(company_id);

-- Backfill: everything under Thetechguyy
DO $$
DECLARE
  v_default uuid;
BEGIN
  SELECT id INTO v_default FROM public.companies WHERE slug = 'thetechguyy' LIMIT 1;
  IF v_default IS NULL THEN
    RAISE EXCEPTION 'Default company thetechguyy missing';
  END IF;

  UPDATE public.profiles SET company_id = v_default WHERE company_id IS NULL;
  UPDATE public.agencies SET company_id = v_default WHERE company_id IS NULL;
  UPDATE public.candidates SET company_id = v_default WHERE company_id IS NULL;
  -- Candidates tied to an agency: align to agency's company (after agencies have company_id)
  UPDATE public.candidates c
  SET company_id = a.company_id
  FROM public.agencies a
  WHERE c.agency_id IS NOT NULL AND c.agency_id = a.id AND a.company_id IS NOT NULL;

  UPDATE public.submissions s
  SET company_id = c.company_id
  FROM public.candidates c
  WHERE s.candidate_id = c.id AND c.company_id IS NOT NULL AND s.company_id IS NULL;

  UPDATE public.interviews i
  SET company_id = c.company_id
  FROM public.candidates c
  WHERE i.candidate_id = c.id AND c.company_id IS NOT NULL AND i.company_id IS NULL;

  UPDATE public.offers o
  SET company_id = c.company_id
  FROM public.candidates c
  WHERE o.candidate_id = c.id AND c.company_id IS NOT NULL AND o.company_id IS NULL;

  UPDATE public.invites SET company_id = v_default WHERE company_id IS NULL;
END $$;

-- Enforce not-null (all rows backfilled)
ALTER TABLE public.profiles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.agencies ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.candidates ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.submissions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.interviews ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.offers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.invites ALTER COLUMN company_id SET NOT NULL;

-- Keep company_id in sync for child rows
CREATE OR REPLACE FUNCTION public.set_submission_company_from_candidate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.company_id IS NULL AND NEW.candidate_id IS NOT NULL THEN
    SELECT c.company_id INTO NEW.company_id FROM public.candidates c WHERE c.id = NEW.candidate_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_company_id ON public.submissions;
CREATE TRIGGER trg_submissions_company_id
  BEFORE INSERT OR UPDATE OF candidate_id, company_id ON public.submissions
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_submission_company_from_candidate();

CREATE OR REPLACE FUNCTION public.set_interview_company_from_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF NEW.company_id IS NULL AND NEW.submission_id IS NOT NULL THEN
    SELECT s.company_id INTO v_company FROM public.submissions s WHERE s.id = NEW.submission_id;
    NEW.company_id := v_company;
  END IF;
  IF NEW.company_id IS NULL AND NEW.candidate_id IS NOT NULL THEN
    SELECT c.company_id INTO v_company FROM public.candidates c WHERE c.id = NEW.candidate_id;
    NEW.company_id := v_company;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interviews_company_id ON public.interviews;
CREATE TRIGGER trg_interviews_company_id
  BEFORE INSERT OR UPDATE OF submission_id, candidate_id, company_id ON public.interviews
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_interview_company_from_submission();

CREATE OR REPLACE FUNCTION public.set_offer_company_from_submission()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company uuid;
BEGIN
  IF NEW.company_id IS NULL AND NEW.submission_id IS NOT NULL THEN
    SELECT s.company_id INTO v_company FROM public.submissions s WHERE s.id = NEW.submission_id;
    NEW.company_id := v_company;
  END IF;
  IF NEW.company_id IS NULL AND NEW.candidate_id IS NOT NULL THEN
    SELECT c.company_id INTO v_company FROM public.candidates c WHERE c.id = NEW.candidate_id;
    NEW.company_id := v_company;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offers_company_id ON public.offers;
CREATE TRIGGER trg_offers_company_id
  BEFORE INSERT OR UPDATE OF submission_id, candidate_id, company_id ON public.offers
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_offer_company_from_submission();

-- Login: return profile (with agency_id, company_id) + company
CREATE OR REPLACE FUNCTION public.login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_hash text;
  v_profile json;
  v_role text;
  v_agency_inactive boolean;
  v_company json;
BEGIN
  SELECT au.id, au.password_hash INTO v_user_id, v_hash
  FROM public.app_users au
  WHERE au.email = trim(lower(p_email));

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_hash IS NULL OR v_hash <> crypt(p_password, v_hash) THEN
    RETURN NULL;
  END IF;

  SELECT r.role::text INTO v_role
  FROM public.user_roles r
  WHERE r.user_id = v_user_id
  LIMIT 1;

  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.agencies a ON a.id = p.agency_id
      WHERE p.user_id = v_user_id
        AND (
          p.is_active = false
          OR (p.agency_id IS NOT NULL AND a.is_active = false)
        )
    )
  INTO v_agency_inactive;

  IF v_agency_inactive THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'full_name', p.full_name,
    'email', p.email,
    'linked_candidate_id', p.linked_candidate_id,
    'is_active', p.is_active,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'agency_id', p.agency_id,
    'company_id', p.company_id
  ) INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  SELECT json_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
  INTO v_company
  FROM public.companies c
  JOIN public.profiles p2 ON p2.company_id = c.id
  WHERE p2.user_id = v_user_id
  LIMIT 1;

  RETURN json_build_object(
    'user_id', v_user_id,
    'email', (SELECT email FROM public.app_users WHERE id = v_user_id),
    'profile', v_profile,
    'role', COALESCE(v_role, 'recruiter'),
    'company', v_company
  );
END;
$$;

-- Public company registration: first user becomes admin
CREATE OR REPLACE FUNCTION public.slugify_company_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from regexp_replace(lower(coalesce($1, '')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.register_company(
  p_company_name text,
  p_admin_email text,
  p_admin_password text,
  p_admin_full_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_slug text;
  v_try text;
  v_n int;
  v_company_id uuid;
  v_user_id uuid;
  v_profile_id uuid;
BEGIN
  p_company_name := trim(p_company_name);
  p_admin_email := trim(lower(p_admin_email));
  IF p_company_name = '' OR length(p_company_name) < 2 THEN
    RAISE EXCEPTION 'Company name is required';
  END IF;
  IF p_admin_email = '' OR position('@' in p_admin_email) < 2 THEN
    RAISE EXCEPTION 'Valid admin email required';
  END IF;
  IF p_admin_password IS NULL OR length(trim(p_admin_password)) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_users WHERE email = p_admin_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  v_slug := public.slugify_company_name(p_company_name);
  IF v_slug = '' OR v_slug IS NULL THEN
    v_slug := 'company';
  END IF;
  v_try := v_slug;
  v_n := 0;
  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = v_try) LOOP
    v_n := v_n + 1;
    v_try := v_slug || '-' || v_n::text;
  END LOOP;

  INSERT INTO public.companies (name, slug)
  VALUES (p_company_name, v_try)
  RETURNING id INTO v_company_id;

  INSERT INTO public.app_users (email, password_hash, updated_at)
  VALUES (p_admin_email, crypt(p_admin_password, gen_salt('bf')), now())
  RETURNING id INTO v_user_id;

  INSERT INTO public.profiles (user_id, full_name, email, is_active, company_id, created_at, updated_at)
  VALUES (v_user_id, COALESCE(NULLIF(trim(p_admin_full_name), ''), p_admin_email), p_admin_email, true, v_company_id, now(), now())
  RETURNING id INTO v_profile_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'admin'::app_role);

  RETURN json_build_object(
    'user_id', v_user_id,
    'email', p_admin_email,
    'role', 'admin',
    'company', json_build_object(
      'id', v_company_id,
      'name', p_company_name,
      'slug', v_try
    ),
    'profile', (
      SELECT json_build_object(
        'id', p.id,
        'user_id', p.user_id,
        'full_name', p.full_name,
        'email', p.email,
        'linked_candidate_id', p.linked_candidate_id,
        'is_active', p.is_active,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'agency_id', p.agency_id,
        'company_id', p.company_id
      )
      FROM public.profiles p
      WHERE p.id = v_profile_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_company(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.register_company(text, text, text, text) TO authenticated;

-- create_app_user: carry company from admin; validate agency is in same company
CREATE OR REPLACE FUNCTION public.create_app_user(
  p_admin_user_id uuid,
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_agency_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_new_id uuid;
  v_profile_id uuid;
  v_role_enum app_role;
  v_agency_id uuid;
  v_caller_agency_id uuid;
  v_admin_company_id uuid;
  v_agency_company_id uuid;
BEGIN
  p_email := trim(lower(p_email));
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  SELECT p.company_id INTO v_admin_company_id FROM public.profiles p WHERE p.user_id = p_admin_user_id LIMIT 1;
  IF v_admin_company_id IS NULL THEN
    RAISE EXCEPTION 'Admin profile not found';
  END IF;

  v_role_enum := p_role::app_role;

  IF v_role_enum = 'agency_admin' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'admin') THEN
    IF p_agency_id IS NULL THEN
      RAISE EXCEPTION 'Agency required for agency admin';
    END IF;
    SELECT company_id INTO v_agency_company_id FROM public.agencies WHERE id = p_agency_id;
    IF v_agency_company_id IS NULL OR v_agency_company_id <> v_admin_company_id THEN
      RAISE EXCEPTION 'Agency does not belong to your company';
    END IF;
    v_agency_id := p_agency_id;
  ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'agency_admin') THEN
    IF v_role_enum NOT IN ('recruiter', 'agency_admin') THEN
      RAISE EXCEPTION 'Agency admin can only create recruiters or agency admins for their agency';
    END IF;
    SELECT agency_id INTO v_caller_agency_id FROM public.profiles WHERE user_id = p_admin_user_id LIMIT 1;
    IF v_caller_agency_id IS NULL THEN
      RAISE EXCEPTION 'Agency admin must belong to an agency';
    END IF;
    SELECT company_id INTO v_agency_company_id FROM public.agencies WHERE id = v_caller_agency_id;
    IF v_agency_company_id IS NULL OR v_agency_company_id <> v_admin_company_id THEN
      RAISE EXCEPTION 'Invalid agency context';
    END IF;
    v_agency_id := v_caller_agency_id;
  ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role IN ('admin','manager','team_lead')) THEN
    v_agency_id := NULL;
  ELSE
    RAISE EXCEPTION 'Only admins, managers, team leads, or agency admins can create users';
  END IF;

  INSERT INTO public.app_users (email, password_hash, updated_at)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), now())
  RETURNING id INTO v_new_id;

  INSERT INTO public.profiles (user_id, full_name, email, is_active, company_id, created_at, updated_at, agency_id)
  VALUES (v_new_id, COALESCE(NULLIF(trim(p_full_name), ''), p_email), p_email, true, v_admin_company_id, now(), now(), v_agency_id)
  RETURNING id INTO v_profile_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_new_id, v_role_enum);

  RETURN json_build_object(
    'user_id', v_new_id,
    'email', p_email,
    'profile_id', v_profile_id
  );
END;
$$;

-- Scope password/details updates to same company
CREATE OR REPLACE FUNCTION public.update_app_user_password(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_agency_id uuid;
  v_target_agency_id uuid;
  v_caller_company uuid;
  v_target_company uuid;
BEGIN
  IF p_password IS NULL OR trim(p_password) = '' THEN
    RAISE EXCEPTION 'Password required';
  END IF;

  SELECT p.company_id INTO v_caller_company FROM public.profiles p WHERE p.user_id = p_admin_user_id;
  SELECT p.company_id INTO v_target_company FROM public.profiles p WHERE p.user_id = p_target_user_id;

  IF v_caller_company IS NULL OR v_target_company IS NULL OR v_caller_company <> v_target_company THEN
    RAISE EXCEPTION 'Not authorized to update password';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role IN ('admin','manager','team_lead')) THEN
    UPDATE public.app_users
      SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    WHERE id = p_target_user_id;
    RETURN json_build_object('ok', true);
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'agency_admin') THEN
    SELECT agency_id INTO v_caller_agency_id FROM public.profiles WHERE user_id = p_admin_user_id LIMIT 1;
    SELECT agency_id INTO v_target_agency_id FROM public.profiles WHERE user_id = p_target_user_id LIMIT 1;
    IF v_caller_agency_id IS NULL OR v_target_agency_id IS NULL OR v_caller_agency_id <> v_target_agency_id THEN
      RAISE EXCEPTION 'You can only update passwords for users in your agency';
    END IF;
    UPDATE public.app_users
      SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    WHERE id = p_target_user_id;
    RETURN json_build_object('ok', true);
  END IF;

  RAISE EXCEPTION 'Not authorized to update password';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_app_user_details(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_agency_id uuid;
  v_target_agency_id uuid;
  v_email text;
  v_caller_company uuid;
  v_target_company uuid;
BEGIN
  v_email := NULLIF(trim(lower(p_email)), '');

  SELECT p.company_id INTO v_caller_company FROM public.profiles p WHERE p.user_id = p_admin_user_id;
  SELECT p.company_id INTO v_target_company FROM public.profiles p WHERE p.user_id = p_target_user_id;
  IF v_caller_company IS NULL OR v_target_company IS NULL OR v_caller_company <> v_target_company THEN
    RAISE EXCEPTION 'Not authorized to update user details';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role IN ('admin','manager','team_lead')) THEN
    IF p_full_name IS NOT NULL AND trim(p_full_name) <> '' THEN
      UPDATE public.profiles SET full_name = trim(p_full_name), updated_at = now() WHERE user_id = p_target_user_id;
    END IF;
    IF v_email IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.app_users WHERE id <> p_target_user_id AND email = v_email) THEN
        RAISE EXCEPTION 'Email already in use';
      END IF;
      UPDATE public.app_users SET email = v_email, updated_at = now() WHERE id = p_target_user_id;
      UPDATE public.profiles SET email = v_email, updated_at = now() WHERE user_id = p_target_user_id;
    END IF;
    RETURN json_build_object('ok', true);
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'agency_admin') THEN
    SELECT agency_id INTO v_caller_agency_id FROM public.profiles WHERE user_id = p_admin_user_id LIMIT 1;
    SELECT agency_id INTO v_target_agency_id FROM public.profiles WHERE user_id = p_target_user_id LIMIT 1;
    IF v_caller_agency_id IS NULL OR v_target_agency_id IS NULL OR v_caller_agency_id <> v_target_agency_id THEN
      RAISE EXCEPTION 'You can only update users in your agency';
    END IF;
    IF p_full_name IS NOT NULL AND trim(p_full_name) <> '' THEN
      UPDATE public.profiles SET full_name = trim(p_full_name), updated_at = now() WHERE user_id = p_target_user_id;
    END IF;
    IF v_email IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.app_users WHERE id <> p_target_user_id AND email = v_email) THEN
        RAISE EXCEPTION 'Email already in use';
      END IF;
      UPDATE public.app_users SET email = v_email, updated_at = now() WHERE id = p_target_user_id;
      UPDATE public.profiles SET email = v_email, updated_at = now() WHERE user_id = p_target_user_id;
    END IF;
    RETURN json_build_object('ok', true);
  END IF;

  RAISE EXCEPTION 'Not authorized to update user details';
END;
$$;

-- Optional RPC: company filter; drop old signatures if present
DROP FUNCTION IF EXISTS public.get_candidate_application_counts(uuid, uuid, text, text, uuid, int, int);
DROP FUNCTION IF EXISTS public.get_candidate_application_counts(uuid, uuid, text, text, uuid, int, int, uuid);

CREATE OR REPLACE FUNCTION public.get_candidate_application_counts(
  p_recruiter_id uuid,
  p_agency_id uuid,
  p_status text,
  p_search text,
  p_candidate_id uuid,
  p_offset int,
  p_limit int,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE (candidate_id uuid, application_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT s.candidate_id, COUNT(*)::bigint
  FROM public.submissions s
  JOIN public.candidates c ON c.id = s.candidate_id
  WHERE (p_company_id IS NULL OR s.company_id = p_company_id)
    AND (p_recruiter_id IS NULL OR s.recruiter_id = p_recruiter_id)
    AND (p_agency_id IS NULL OR c.agency_id = p_agency_id)
    AND (p_candidate_id IS NULL OR s.candidate_id = p_candidate_id)
  GROUP BY s.candidate_id
  ORDER BY s.candidate_id
  OFFSET COALESCE(p_offset, 0)
  LIMIT COALESCE(p_limit, 200000);
$$;

GRANT EXECUTE ON FUNCTION public.get_candidate_application_counts(uuid, uuid, text, text, uuid, int, int, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_candidate_application_counts(uuid, uuid, text, text, uuid, int, int, uuid) TO authenticated;

COMMENT ON TABLE public.companies IS 'Multi-tenant companies; all domain data is scoped by company_id.';
