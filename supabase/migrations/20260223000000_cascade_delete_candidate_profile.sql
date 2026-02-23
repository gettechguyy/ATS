-- Cascade-delete related profile, app_user and user_roles when a candidate is deleted
-- This ensures deleting a candidate does not leave orphaned profiles or app users
-- Run with supabase db push or via SQL editor.

CREATE OR REPLACE FUNCTION public.handle_candidate_cascade_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- For every profile linked to the deleted candidate, remove associated user_roles, profile and app_user.
  FOR rec IN SELECT user_id FROM public.profiles WHERE linked_candidate_id = OLD.id LOOP
    -- Remove role assignments first
    DELETE FROM public.user_roles WHERE user_id = rec.user_id;
    -- Remove profile
    DELETE FROM public.profiles WHERE user_id = rec.user_id;
    -- Remove the underlying app_user (credentials)
    DELETE FROM public.app_users WHERE id = rec.user_id;
  END LOOP;

  RETURN OLD;
END;
$$;

-- Trigger to call the function after a candidate row is deleted
DROP TRIGGER IF EXISTS trg_candidate_cascade_delete ON public.candidates;
CREATE TRIGGER trg_candidate_cascade_delete
BEFORE DELETE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.handle_candidate_cascade_delete();

