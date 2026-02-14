
-- ============================================
-- DROP EXISTING DOMAIN TABLES
-- ============================================
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS interviews CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;

-- ============================================
-- DROP OLD ENUMS
-- ============================================
DROP TYPE IF EXISTS acceptance_status CASCADE;
DROP TYPE IF EXISTS application_status CASCADE;
DROP TYPE IF EXISTS candidate_status CASCADE;
DROP TYPE IF EXISTS employment_type CASCADE;
DROP TYPE IF EXISTS interview_mode CASCADE;
DROP TYPE IF EXISTS visa_status CASCADE;

-- ============================================
-- EXPAND app_role ENUM (drop & recreate)
-- ============================================
ALTER TABLE user_roles ALTER COLUMN role TYPE text;
DROP TYPE IF EXISTS app_role CASCADE;
CREATE TYPE app_role AS ENUM ('admin', 'recruiter', 'candidate', 'manager');
ALTER TABLE user_roles ALTER COLUMN role TYPE app_role USING role::app_role;

-- ============================================
-- RECREATE SECURITY FUNCTIONS (dropped with enum)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============================================
-- CREATE NEW ENUMS
-- ============================================
CREATE TYPE candidate_status AS ENUM ('New', 'In Marketing', 'Placed', 'Backout', 'On Bench', 'In Training');
CREATE TYPE submission_status AS ENUM ('Applied', 'Screen Call', 'Interview', 'Rejected', 'Offered');
CREATE TYPE interview_status AS ENUM ('Scheduled', 'Passed', 'Rejected', 'Rescheduled');
CREATE TYPE interview_mode AS ENUM ('Virtual', 'Onsite', 'Phone');
CREATE TYPE offer_status AS ENUM ('Pending', 'Accepted', 'Declined');

-- ============================================
-- ADD COLUMNS TO PROFILES
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linked_candidate_id uuid;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- ============================================
-- CANDIDATES TABLE
-- ============================================
CREATE TABLE candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  resume_url text,
  status candidate_status DEFAULT 'New',
  recruiter_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_candidates_recruiter ON candidates(recruiter_id);

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_linked_candidate
  FOREIGN KEY (linked_candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;

-- ============================================
-- SUBMISSIONS TABLE
-- ============================================
CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  recruiter_id uuid,
  client_name text NOT NULL,
  position text NOT NULL,
  status submission_status DEFAULT 'Applied',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_submissions_candidate ON submissions(candidate_id);
CREATE INDEX idx_submissions_recruiter ON submissions(recruiter_id);

-- ============================================
-- INTERVIEWS TABLE
-- ============================================
CREATE TABLE interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  round_number int DEFAULT 1,
  status interview_status DEFAULT 'Scheduled',
  mode interview_mode DEFAULT 'Virtual',
  scheduled_at timestamptz,
  virtual_link text,
  feedback text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_interviews_submission ON interviews(submission_id);
CREATE INDEX idx_interviews_candidate ON interviews(candidate_id);

-- ============================================
-- INTERVIEW RESCHEDULE LOGS
-- ============================================
CREATE TABLE interview_reschedule_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES interviews(id) ON DELETE CASCADE NOT NULL,
  old_date timestamptz,
  new_date timestamptz,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid
);
CREATE INDEX idx_reschedule_interview ON interview_reschedule_logs(interview_id);

-- ============================================
-- OFFERS TABLE
-- ============================================
CREATE TABLE offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES submissions(id) ON DELETE CASCADE NOT NULL,
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  salary numeric,
  status offer_status DEFAULT 'Pending',
  offered_at timestamptz DEFAULT now()
);
CREATE INDEX idx_offers_submission ON offers(submission_id);
CREATE INDEX idx_offers_candidate ON offers(candidate_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION public.can_access_candidate(_user_id uuid, _candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM candidates WHERE id = _candidate_id
    AND (is_admin(_user_id) OR recruiter_id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_linked_candidate(_user_id uuid, _candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = _user_id AND linked_candidate_id = _candidate_id
  )
$$;

-- ============================================
-- RLS: CANDIDATES
-- ============================================
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access candidates" ON candidates FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Recruiter view own candidates" ON candidates FOR SELECT TO authenticated
  USING (recruiter_id = auth.uid());
CREATE POLICY "Recruiter insert candidates" ON candidates FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'recruiter') AND recruiter_id = auth.uid());
CREATE POLICY "Recruiter update own candidates" ON candidates FOR UPDATE TO authenticated
  USING (recruiter_id = auth.uid());
CREATE POLICY "Candidate view own record" ON candidates FOR SELECT TO authenticated
  USING (is_linked_candidate(auth.uid(), id));

-- ============================================
-- RLS: SUBMISSIONS
-- ============================================
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access submissions" ON submissions FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Recruiter view own submissions" ON submissions FOR SELECT TO authenticated
  USING (recruiter_id = auth.uid());
CREATE POLICY "Recruiter insert submissions" ON submissions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'recruiter') AND recruiter_id = auth.uid());
CREATE POLICY "Recruiter update own submissions" ON submissions FOR UPDATE TO authenticated
  USING (recruiter_id = auth.uid());
CREATE POLICY "Candidate view own submissions" ON submissions FOR SELECT TO authenticated
  USING (is_linked_candidate(auth.uid(), candidate_id));
CREATE POLICY "Manager view all submissions" ON submissions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'));

-- ============================================
-- RLS: INTERVIEWS
-- ============================================
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access interviews" ON interviews FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Recruiter view own interviews" ON interviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM submissions s WHERE s.id = interviews.submission_id AND s.recruiter_id = auth.uid()));
CREATE POLICY "Recruiter insert interviews" ON interviews FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_id AND s.recruiter_id = auth.uid()));
CREATE POLICY "Recruiter update interviews" ON interviews FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM submissions s WHERE s.id = interviews.submission_id AND s.recruiter_id = auth.uid()));
CREATE POLICY "Candidate view own interviews" ON interviews FOR SELECT TO authenticated
  USING (is_linked_candidate(auth.uid(), candidate_id));
CREATE POLICY "Manager view all interviews" ON interviews FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'));

-- ============================================
-- RLS: RESCHEDULE LOGS
-- ============================================
ALTER TABLE interview_reschedule_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access reschedule logs" ON interview_reschedule_logs FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Recruiter view reschedule logs" ON interview_reschedule_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM interviews i JOIN submissions s ON s.id = i.submission_id
    WHERE i.id = interview_reschedule_logs.interview_id AND s.recruiter_id = auth.uid()
  ));
CREATE POLICY "Recruiter insert reschedule logs" ON interview_reschedule_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM interviews i JOIN submissions s ON s.id = i.submission_id
    WHERE i.id = interview_id AND s.recruiter_id = auth.uid()
  ));

-- ============================================
-- RLS: OFFERS
-- ============================================
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access offers" ON offers FOR ALL TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Recruiter view own offers" ON offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM submissions s WHERE s.id = offers.submission_id AND s.recruiter_id = auth.uid()));
CREATE POLICY "Recruiter insert offers" ON offers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM submissions s WHERE s.id = submission_id AND s.recruiter_id = auth.uid()));
CREATE POLICY "Candidate view own offers" ON offers FOR SELECT TO authenticated
  USING (is_linked_candidate(auth.uid(), candidate_id));
CREATE POLICY "Manager view all offers" ON offers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'));

-- ============================================
-- UPDATE handle_new_user
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'recruiter'));
  RETURN NEW;
END;
$$;
