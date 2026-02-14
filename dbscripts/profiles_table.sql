CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  linked_candidate_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Foreign key to candidates (optional link)
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_linked_candidate
  FOREIGN KEY (linked_candidate_id) REFERENCES public.candidates(id);
