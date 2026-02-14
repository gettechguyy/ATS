-- Enums used across the schema
CREATE TYPE public.app_role AS ENUM ('admin', 'recruiter', 'candidate', 'manager');

CREATE TYPE public.candidate_status AS ENUM (
  'New', 'In Marketing', 'Placed', 'Backout', 'On Bench', 'In Training'
);

CREATE TYPE public.submission_status AS ENUM (
  'Applied', 'Screen Call', 'Interview', 'Rejected', 'Offered'
);

CREATE TYPE public.interview_status AS ENUM (
  'Scheduled', 'Passed', 'Rejected', 'Rescheduled'
);

CREATE TYPE public.interview_mode AS ENUM ('Virtual', 'Onsite', 'Phone');

CREATE TYPE public.offer_status AS ENUM ('Pending', 'Accepted', 'Declined');
