-- Ensure the existing master admin user is identified as Thetechguyy (full_name and email).
-- Run after agencies migration; updates the first admin user to Thetechguyy identity.
DO $$
DECLARE v_admin_user_id uuid;
BEGIN
  SELECT user_id INTO v_admin_user_id
  FROM public.user_roles
  WHERE role = 'admin'
  LIMIT 1;

  IF v_admin_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = 'Thetechguyy', email = 'admin@thetechguyy.com', updated_at = now()
    WHERE user_id = v_admin_user_id;

    UPDATE public.app_users
    SET email = 'admin@thetechguyy.com', updated_at = now()
    WHERE id = v_admin_user_id;
  END IF;
END $$;
