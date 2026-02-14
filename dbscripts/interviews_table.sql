CREATE TABLE public.interviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.submissions(id),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  round_number integer DEFAULT 1,
  status public.interview_status DEFAULT 'Scheduled'::interview_status,
  mode public.interview_mode DEFAULT 'Virtual'::interview_mode,
  scheduled_at timestamp with time zone,
  virtual_link text,
  feedback text,
  created_at timestamp with time zone DEFAULT now()
);
