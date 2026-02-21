-- Add/replace foreign key constraints to enable cascade deletes where appropriate
-- Safe: DROP CONSTRAINT IF EXISTS used to avoid errors if names differ

-- Submissions -> candidates (cascade)
ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_candidate_id_fkey;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;

-- Interviews -> submissions (cascade)
ALTER TABLE public.interviews
  DROP CONSTRAINT IF EXISTS interviews_submission_id_fkey;
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;

-- Interviews -> candidates (cascade)
ALTER TABLE public.interviews
  DROP CONSTRAINT IF EXISTS interviews_candidate_id_fkey;
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;

-- Offers -> submissions (cascade)
ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_submission_id_fkey;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE;

-- Offers -> candidates (cascade)
ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_candidate_id_fkey;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;

-- Profiles.linked_candidate_id -> candidates (set null on candidate delete)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_linked_candidate;
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_linked_candidate FOREIGN KEY (linked_candidate_id) REFERENCES public.candidates(id) ON DELETE SET NULL;

-- Make profiles.user_id reference app_users and cascade on user delete
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;

-- Make user_roles.user_id reference app_users and cascade on user delete
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;

-- Make candidates.recruiter_id reference app_users and set null on user delete
ALTER TABLE public.candidates
  DROP CONSTRAINT IF EXISTS candidates_recruiter_id_fkey;
ALTER TABLE public.candidates
  ADD CONSTRAINT candidates_recruiter_id_fkey FOREIGN KEY (recruiter_id) REFERENCES public.app_users(id) ON DELETE SET NULL;

