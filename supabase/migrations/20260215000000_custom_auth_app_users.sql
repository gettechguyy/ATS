-- ============================================
-- CUSTOM AUTH: app_users table + login/create_app_user
-- Run this in Supabase SQL Editor if not using supabase db push.
-- After this, disable Supabase Auth and use app login only.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- App users table (email + hashed password). Replaces auth.users for app login.
CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Allow anon to call login (no auth required for login). search_path includes extensions so crypt() is found.
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

-- Only admins can create new users. Pass current user id; RPC checks admin. search_path includes extensions for crypt/gen_salt.
CREATE OR REPLACE FUNCTION public.create_app_user(
  p_admin_user_id uuid,
  p_email text,
  p_password text,
  p_full_name text,
  p_role text
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
BEGIN
  -- Allow admins, managers, or team_leads to create users
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role IN ('admin','manager','team_lead')) THEN
    RAISE EXCEPTION 'Only admins, managers, or team leads can create users';
  END IF;

  p_email := trim(lower(p_email));
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;

  v_role_enum := p_role::app_role;

  INSERT INTO public.app_users (email, password_hash, updated_at)
  VALUES (p_email, crypt(p_password, gen_salt('bf')), now())
  RETURNING id INTO v_new_id;

  INSERT INTO public.profiles (user_id, full_name, email, is_active, created_at, updated_at)
  VALUES (v_new_id, COALESCE(NULLIF(trim(p_full_name), ''), p_email), p_email, true, now(), now())
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

-- Optional: drop FK from profiles/user_roles to auth.users so user_id can reference app_users.
-- Uncomment if you have existing FKs and want to use only app_users.
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
-- ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- Grant execute to anon so frontend can call login and create_app_user
GRANT EXECUTE ON FUNCTION public.login(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.login(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_app_user(uuid, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_app_user(uuid, text, text, text, text) TO authenticated;

-- No direct access to app_users; login only via login() RPC.
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct anon access app_users" ON public.app_users FOR ALL TO anon USING (false);
CREATE POLICY "No direct authenticated access app_users" ON public.app_users FOR ALL TO authenticated USING (false);

-- With custom auth, auth.uid() is null so RLS would block everything. Disable RLS on app tables
-- that exist so the frontend (anon key) can access data; enforce admin/recruiter rules in the app.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['profiles', 'user_roles', 'candidates', 'submissions', 'interviews', 'interview_reschedule_logs', 'offers'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- Allow privileged users to update an app user's password (hash stored using crypt)
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
BEGIN
  -- Allow admins, managers, or team leads to update passwords
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_admin_user_id AND role IN ('admin','manager','team_lead')) THEN
    RAISE EXCEPTION 'Only admins, managers, or team leads can update passwords';
  END IF;

  IF p_password IS NULL OR trim(p_password) = '' THEN
    RAISE EXCEPTION 'Password required';
  END IF;

  UPDATE public.app_users
    SET password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    WHERE id = p_target_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_app_user_password(uuid, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.update_app_user_password(uuid, uuid, text) TO authenticated;

-- ============================================
-- DEFAULT ADMIN: Create once so you can log in (idempotent: only if no admin exists).
-- Email: admin@example.com  |  Password: Yavin@2025  |  Role: admin
-- ============================================
DO $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' LIMIT 1) THEN
    INSERT INTO public.app_users (email, password_hash, updated_at)
    VALUES ('admin@example.com', extensions.crypt('Yavin@2025', extensions.gen_salt('bf')), now())
    RETURNING id INTO v_id;
    INSERT INTO public.profiles (user_id, full_name, email, is_active, created_at, updated_at)
    VALUES (v_id, 'Admin', 'admin@example.com', true, now(), now());
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_id, 'admin');
  END IF;
END $$;
