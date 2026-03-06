-- Allow agency_admin to create users for their agency (recruiter or agency_admin).
-- Fix: check caller is agency_admin before falling through to "only admins, managers, team leads".
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
BEGIN
  p_email := trim(lower(p_email));
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  v_role_enum := p_role::app_role;

  -- Master admin creating agency_admin: must pass agency_id
  IF v_role_enum = 'agency_admin' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'admin') THEN
    IF p_agency_id IS NULL THEN
      RAISE EXCEPTION 'Agency required for agency admin';
    END IF;
    v_agency_id := p_agency_id;
  -- Agency admin creating users for their agency: recruiter or agency_admin (display as Admin)
  ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'agency_admin') THEN
    IF v_role_enum NOT IN ('recruiter', 'agency_admin') THEN
      RAISE EXCEPTION 'Agency admin can only create recruiters or agency admins for their agency';
    END IF;
    SELECT agency_id INTO v_caller_agency_id FROM public.profiles WHERE user_id = p_admin_user_id LIMIT 1;
    IF v_caller_agency_id IS NULL THEN
      RAISE EXCEPTION 'Agency admin must belong to an agency';
    END IF;
    v_agency_id := v_caller_agency_id;
  -- Admins, managers, team_leads create users (no agency)
  ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role IN ('admin','manager','team_lead')) THEN
    v_agency_id := NULL;
  ELSE
    RAISE EXCEPTION 'Only admins, managers, team leads, or agency admins can create users';
  END IF;

  INSERT INTO public.app_users (email, password_hash, updated_at)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), now())
  RETURNING id INTO v_new_id;

  INSERT INTO public.profiles (user_id, full_name, email, is_active, created_at, updated_at, agency_id)
  VALUES (v_new_id, COALESCE(NULLIF(trim(p_full_name), ''), p_email), p_email, true, now(), now(), v_agency_id)
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
