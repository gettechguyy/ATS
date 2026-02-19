-- Create candidate_educations and candidate_experiences tables
CREATE TABLE IF NOT EXISTS candidate_educations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  degree text,
  institution text,
  field_of_study text,
  start_date date,
  end_date date,
  graduation_year text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_educations_candidate ON candidate_educations(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  company text,
  role text,
  start_date date,
  end_date date,
  current boolean DEFAULT false,
  technologies text,
  responsibilities text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_experiences_candidate ON candidate_experiences(candidate_id);

