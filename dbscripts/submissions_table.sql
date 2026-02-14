CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  recruiter_id uuid,
  client_name text NOT NULL,
  position text NOT NULL,
  status public.submission_status DEFAULT 'Applied'::submission_status,
  created_at timestamp with time zone DEFAULT now()
);
