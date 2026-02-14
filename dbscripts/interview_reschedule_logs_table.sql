CREATE TABLE public.interview_reschedule_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  interview_id uuid NOT NULL REFERENCES public.interviews(id),
  old_date timestamp with time zone,
  new_date timestamp with time zone,
  changed_by uuid,
  changed_at timestamp with time zone DEFAULT now()
);
