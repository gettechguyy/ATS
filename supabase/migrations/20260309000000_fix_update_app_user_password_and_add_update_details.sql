-- Ensure update_app_user_password exists and is callable (fixes PGRST202 schema cache)
-- and add update_app_user_details so main admin can edit user full_name and email.

-- update_app_user_password: admin/manager/team_lead can update any; agency_admin only same agency
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

GRANT EXECUTE ON FUNCTION public.update_app_user_password(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_app_user_password(uuid, uuid, text) TO authenticated;

-- update_app_user_details: main admin (and manager/team_lead) can edit full_name and email; agency_admin for same agency
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
BEGIN
  v_email := NULLIF(trim(lower(p_email)), '');

  -- Master admin / manager / team_lead: can update any user's details
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

  -- Agency admin: only users in same agency
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

GRANT EXECUTE ON FUNCTION public.update_app_user_details(uuid, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_app_user_details(uuid, uuid, text, text) TO authenticated;
