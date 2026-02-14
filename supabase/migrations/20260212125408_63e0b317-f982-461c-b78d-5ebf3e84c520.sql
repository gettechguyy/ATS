
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter');
CREATE TYPE public.visa_status AS ENUM ('OPT', 'H1B', 'GC', 'Citizen', 'Other');
CREATE TYPE public.candidate_status AS ENUM ('Assigned', 'Active Marketing', 'Interviewing', 'Offer Received', 'Placed', 'Closed');
CREATE TYPE public.application_status AS ENUM ('Applied', 'Screen Call', 'Interview Round 1', 'Interview Round 2', 'Interview Round 3+', 'Offered', 'Closed');
CREATE TYPE public.interview_mode AS ENUM ('Video', 'Phone');
CREATE TYPE public.employment_type AS ENUM ('Full-time', 'Contract', 'C2C');
CREATE TYPE public.acceptance_status AS ENUM ('Pending', 'Accepted', 'Rejected');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  visa_status visa_status NOT NULL DEFAULT 'Other',
  assigned_recruiter_id UUID REFERENCES auth.users(id) NOT NULL,
  status candidate_status NOT NULL DEFAULT 'Assigned',
  resume_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Applications table
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  client_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  location TEXT,
  job_portal TEXT,
  job_link TEXT,
  status application_status NOT NULL DEFAULT 'Applied',
  client_response BOOLEAN,
  date_applied DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Interviews table
CREATE TABLE public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL DEFAULT 1,
  interview_date DATE NOT NULL,
  interview_time TIME NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'EST',
  mode interview_mode NOT NULL DEFAULT 'Video',
  joining_link TEXT,
  calling_number TEXT,
  salary_rate TEXT,
  job_description TEXT,
  resume_submitted BOOLEAN DEFAULT false,
  interview_questions_url TEXT,
  internal_feedback TEXT,
  client_feedback TEXT,
  next_round BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Offers table
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  offer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  offered_salary TEXT NOT NULL,
  employment_type employment_type NOT NULL DEFAULT 'Full-time',
  joining_date DATE,
  offer_letter_url TEXT,
  acceptance_status acceptance_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Helper function: check if user has any role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: can user access candidate
CREATE OR REPLACE FUNCTION public.can_access_candidate(_user_id UUID, _candidate_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidates
    WHERE id = _candidate_id
    AND (public.is_admin(_user_id) OR assigned_recruiter_id = _user_id)
  )
$$;

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  -- Default role: recruiter
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'recruiter');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- USER_ROLES policies
CREATE POLICY "Authenticated users can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- CANDIDATES policies
CREATE POLICY "View candidates" ON public.candidates FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR assigned_recruiter_id = auth.uid());
CREATE POLICY "Insert candidates" ON public.candidates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR assigned_recruiter_id = auth.uid());
CREATE POLICY "Update candidates" ON public.candidates FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR assigned_recruiter_id = auth.uid());
CREATE POLICY "Only admins delete candidates" ON public.candidates FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- APPLICATIONS policies
CREATE POLICY "View applications" ON public.applications FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.can_access_candidate(auth.uid(), candidate_id));
CREATE POLICY "Insert applications" ON public.applications FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.can_access_candidate(auth.uid(), candidate_id));
CREATE POLICY "Update applications" ON public.applications FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.can_access_candidate(auth.uid(), candidate_id));
CREATE POLICY "Only admins delete applications" ON public.applications FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- INTERVIEWS policies
CREATE POLICY "View interviews" ON public.interviews FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND public.can_access_candidate(auth.uid(), a.candidate_id)
    )
  );
CREATE POLICY "Insert interviews" ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND public.can_access_candidate(auth.uid(), a.candidate_id)
    )
  );
CREATE POLICY "Update interviews" ON public.interviews FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND public.can_access_candidate(auth.uid(), a.candidate_id)
    )
  );
CREATE POLICY "Only admins delete interviews" ON public.interviews FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- OFFERS policies
CREATE POLICY "View offers" ON public.offers FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND public.can_access_candidate(auth.uid(), a.candidate_id)
    )
  );
CREATE POLICY "Insert offers" ON public.offers FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND public.can_access_candidate(auth.uid(), a.candidate_id)
    )
  );
CREATE POLICY "Update offers" ON public.offers FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.id = application_id AND public.can_access_candidate(auth.uid(), a.candidate_id)
    )
  );
CREATE POLICY "Only admins delete offers" ON public.offers FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Storage bucket for resumes and documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can update own documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));
