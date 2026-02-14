CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES public.submissions(id),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id),
  salary numeric,
  status public.offer_status DEFAULT 'Pending'::offer_status,
  offered_at timestamp with time zone DEFAULT now()
);
