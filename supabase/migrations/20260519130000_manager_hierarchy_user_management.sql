-- Scope manager/team_lead password and profile updates to users in their hierarchy.

CREATE OR REPLACE FUNCTION public.hierarchy_caller_can_manage_user(
  p_caller_user_id uuid,
  p_target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
  v_caller_profile_id uuid;
  v_target_role text;
BEGIN
  IF p_caller_user_id = p_target_user_id THEN
    RETURN true;
  END IF;

  SELECT r.role::text INTO v_caller_role
  FROM public.user_roles r
  WHERE r.user_id = p_caller_user_id
  LIMIT 1;

  SELECT r.role::text INTO v_target_role
  FROM public.user_roles r
  WHERE r.user_id = p_target_user_id
  LIMIT 1;

  SELECT p.id INTO v_caller_profile_id
  FROM public.profiles p
  WHERE p.user_id = p_caller_user_id
  LIMIT 1;

  IF v_caller_role = 'admin' THEN
    RETURN v_target_role IS DISTINCT FROM 'candidate';
  END IF;

  IF v_caller_role = 'manager' AND v_caller_profile_id IS NOT NULL THEN
    IF v_target_role = 'team_lead' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = p_target_user_id
        AND manager_profile_id = v_caller_profile_id
    ) THEN
      RETURN true;
    END IF;
    IF v_target_role = 'recruiter' AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.user_id = p_target_user_id
        AND pr.team_lead_profile_id IN (
          SELECT tl.id FROM public.profiles tl
          WHERE tl.manager_profile_id = v_caller_profile_id
        )
    ) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  IF v_caller_role = 'team_lead' AND v_caller_profile_id IS NOT NULL THEN
    IF v_target_role = 'recruiter' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = p_target_user_id
        AND team_lead_profile_id = v_caller_profile_id
    ) THEN
      RETURN true;
    END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$$;

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

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'admin') THEN
    UPDATE public.app_users
      SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    WHERE id = p_target_user_id;
    RETURN json_build_object('ok', true);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_admin_user_id AND role IN ('manager', 'team_lead')
  ) THEN
    IF NOT public.hierarchy_caller_can_manage_user(p_admin_user_id, p_target_user_id) THEN
      RAISE EXCEPTION 'You can only update passwords for users in your team';
    END IF;
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

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'admin') THEN
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

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_admin_user_id AND role IN ('manager', 'team_lead')
  ) THEN
    IF NOT public.hierarchy_caller_can_manage_user(p_admin_user_id, p_target_user_id) THEN
      RAISE EXCEPTION 'You can only update users in your team';
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
