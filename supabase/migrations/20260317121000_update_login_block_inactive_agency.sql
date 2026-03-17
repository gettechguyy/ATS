-- Ensure agency users cannot log in if either their profile is inactive
-- or their agency has been disabled via agencies.is_active = false.

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

  -- Block login when profile is inactive OR (for agency-linked users) agency is inactive.
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
    'updated_at', p.updated_at
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

