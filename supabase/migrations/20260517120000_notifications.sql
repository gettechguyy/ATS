-- In-app notifications for company admins (realtime-enabled).

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_company_created
  ON public.notifications (user_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, company_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Notify every active admin profile in the company.
CREATE OR REPLACE FUNCTION public.notify_company_admins(
  p_company_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    company_id,
    user_id,
    type,
    title,
    body,
    link,
    entity_type,
    entity_id
  )
  SELECT
    p_company_id,
    p.user_id,
    p_type,
    p_title,
    p_body,
    p_link,
    p_entity_type,
    p_entity_id
  FROM public.profiles p
  INNER JOIN public.user_roles r ON r.user_id = p.user_id
  WHERE p.company_id = p_company_id
    AND r.role = 'admin'
    AND COALESCE(p.is_active, true) = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_new_candidate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := trim(concat_ws(' ', NEW.first_name, NEW.last_name));
  PERFORM public.notify_company_admins(
    NEW.company_id,
    'candidate_created',
    'New candidate',
    v_name || ' was added to the pipeline.',
    '/candidates/' || NEW.id::text,
    'candidate',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_new_interview()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_position text;
  v_client text;
BEGIN
  SELECT
    trim(concat_ws(' ', c.first_name, c.last_name)),
    COALESCE(s.position, 'Role'),
    COALESCE(s.client_name, 'Client')
  INTO v_name, v_position, v_client
  FROM public.candidates c
  LEFT JOIN public.submissions s ON s.id = NEW.submission_id
  WHERE c.id = NEW.candidate_id;

  PERFORM public.notify_company_admins(
    NEW.company_id,
    'interview_scheduled',
    'Interview scheduled',
    'Round ' || NEW.round_number::text || ' for ' || COALESCE(v_name, 'candidate')
      || ' — ' || v_position || ' at ' || v_client || '.',
    CASE
      WHEN NEW.submission_id IS NOT NULL THEN '/submissions/' || NEW.submission_id::text
      ELSE '/interviews'
    END,
    'interview',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notify_new_offer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_position text;
BEGIN
  SELECT
    trim(concat_ws(' ', c.first_name, c.last_name)),
    COALESCE(s.position, 'Role')
  INTO v_name, v_position
  FROM public.candidates c
  LEFT JOIN public.submissions s ON s.id = NEW.submission_id
  WHERE c.id = NEW.candidate_id;

  PERFORM public.notify_company_admins(
    NEW.company_id,
    'offer_created',
    'New offer',
    'Offer for ' || COALESCE(v_name, 'candidate') || ' — ' || v_position
      || ' ($' || NEW.salary::text || ').',
    CASE
      WHEN NEW.submission_id IS NOT NULL THEN '/submissions/' || NEW.submission_id::text
      ELSE '/offers'
    END,
    'offer',
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_new_candidate ON public.candidates;
CREATE TRIGGER trg_notifications_new_candidate
  AFTER INSERT ON public.candidates
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_notify_new_candidate();

DROP TRIGGER IF EXISTS trg_notifications_new_interview ON public.interviews;
CREATE TRIGGER trg_notifications_new_interview
  AFTER INSERT ON public.interviews
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_notify_new_interview();

DROP TRIGGER IF EXISTS trg_notifications_new_offer ON public.offers;
CREATE TRIGGER trg_notifications_new_offer
  AFTER INSERT ON public.offers
  FOR EACH ROW
  EXECUTE PROCEDURE public.trg_notify_new_offer();

-- Realtime: broadcast new notifications to subscribed clients.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
  END IF;
END $$;
