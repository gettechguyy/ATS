CREATE TABLE public.candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  resume_url text,
  status public.candidate_status DEFAULT 'New'::candidate_status,
  recruiter_id uuid,
  created_at timestamp with time zone DEFAULT now()
);
