-- RPC to create app user from invite token
CREATE OR REPLACE FUNCTION public.create_user_from_invite(p_token text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_inv RECORD;
  v_new_id uuid;
  v_profile_id uuid;
  v_candidate_id uuid;
  v_existing_user_id uuid;
  v_first text;
  v_last text;
BEGIN
  SELECT * INTO v_inv FROM invites WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite token';
  END IF;
  IF v_inv.used THEN
    RAISE EXCEPTION 'Invite already used';
  END IF;
  -- if an app_user already exists for this email, reuse it; otherwise create one.
  SELECT id INTO v_existing_user_id FROM public.app_users WHERE email = trim(lower(v_inv.email)) LIMIT 1;
  IF v_existing_user_id IS NULL THEN
    -- create app_user
    INSERT INTO public.app_users (email, password_hash, updated_at)
    VALUES (trim(lower(v_inv.email)), crypt(p_password, gen_salt('bf')), now())
    RETURNING id INTO v_new_id;
  ELSE
    v_new_id := v_existing_user_id;
    -- update password to the provided one (invite sets the password)
    UPDATE public.app_users
    SET password_hash = crypt(p_password, gen_salt('bf')), updated_at = now()
    WHERE id = v_new_id;
  END IF;

  -- create profile
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_new_id LIMIT 1;
  IF v_profile_id IS NULL THEN
    INSERT INTO public.profiles (user_id, full_name, email, is_active, created_at, updated_at)
    VALUES (v_new_id, COALESCE(NULLIF(trim(v_inv.full_name), ''), v_inv.email), v_inv.email, true, now(), now())
    RETURNING id INTO v_profile_id;
  END IF;

  -- create role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_new_id AND role = v_inv.role::app_role) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_new_id, v_inv.role::app_role);
  END IF;

  -- if this invite is for a candidate, either link to an existing candidate (if provided) or create a new one
  IF v_inv.role = 'candidate' THEN
    IF v_inv.candidate_id IS NOT NULL THEN
      v_candidate_id := v_inv.candidate_id;
    ELSE
      v_first := split_part(COALESCE(NULLIF(trim(v_inv.full_name), ''), v_inv.email), ' ', 1);
      v_last := CASE WHEN position(' ' IN COALESCE(NULLIF(trim(v_inv.full_name), ''), v_inv.email)) > 0
                    THEN substr(COALESCE(NULLIF(trim(v_inv.full_name), ''), v_inv.email), position(' ' IN COALESCE(NULLIF(trim(v_inv.full_name), ''), v_inv.email)) + 1)
                    ELSE NULL END;
      INSERT INTO public.candidates (first_name, last_name, email, status, created_at)
      VALUES (v_first, v_last, v_inv.email, 'New', now())
      RETURNING id INTO v_candidate_id;
    END IF;

    UPDATE public.profiles SET linked_candidate_id = v_candidate_id WHERE id = v_profile_id;
  END IF;

  -- mark invite used
  UPDATE invites SET used = true, used_at = now() WHERE id = v_inv.id;

  RETURN json_build_object('user_id', v_new_id, 'profile_id', v_profile_id);
END;
$$;

-- Grant execute to anon so frontend can call it
GRANT EXECUTE ON FUNCTION public.create_user_from_invite(text, text) TO anon;

