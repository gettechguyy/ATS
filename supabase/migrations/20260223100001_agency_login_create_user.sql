-- Login: include agency_id in profile json
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

  SELECT json_build_object(
    'id', p.id,
    'user_id', p.user_id,
    'full_name', p.full_name,
    'email', p.email,
    'linked_candidate_id', p.linked_candidate_id,
    'is_active', p.is_active,
    'created_at', p.created_at,
    'updated_at', p.updated_at,
    'agency_id', p.agency_id
  ) INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  RETURN json_build_object(
    'user_id', v_user_id,
    'email', (SELECT email FROM public.app_users WHERE id = v_user_id),
    'profile', v_profile,
    'role', COALESCE(v_role, 'recruiter')
  );
END;
$$;

-- create_app_user: add optional p_agency_id for creating agency admin (caller must be admin) or agency recruiter (caller agency_admin)
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

  -- Agency admin: only master admin can create; must pass agency_id; new user gets that agency_id
  IF v_role_enum = 'agency_admin' THEN
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Only master admin can create agency admin';
    END IF;
    IF p_agency_id IS NULL THEN
      RAISE EXCEPTION 'Agency required for agency admin';
    END IF;
    v_agency_id := p_agency_id;
  ELSIF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role = 'agency_admin') THEN
    -- Caller is agency admin: can only create recruiters in their agency
    IF v_role_enum <> 'recruiter' THEN
      RAISE EXCEPTION 'Agency admin can only create recruiters';
    END IF;
    SELECT agency_id INTO v_caller_agency_id FROM public.profiles WHERE user_id = p_admin_user_id LIMIT 1;
    IF v_caller_agency_id IS NULL THEN
      RAISE EXCEPTION 'Agency admin must belong to an agency';
    END IF;
    v_agency_id := v_caller_agency_id;
  ELSE
    -- Existing: admins, managers, team_leads create users (no agency)
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role IN ('admin','manager','team_lead')) THEN
      RAISE EXCEPTION 'Only admins, managers, or team leads can create users';
    END IF;
    v_agency_id := NULL;
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

-- update_app_user_password: allow agency_admin to update passwords of users in their agency
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
BEGIN
  IF p_password IS NULL OR trim(p_password) = '' THEN
    RAISE EXCEPTION 'Password required';
  END IF;

  -- Master admin / manager / team_lead: existing behavior
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role IN ('admin','manager','team_lead')) THEN
    UPDATE public.app_users
      SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    WHERE id = p_target_user_id;
    RETURN json_build_object('ok', true);
  END IF;

  -- Agency admin: can only update users in same agency
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
