-- Add new candidate statuses: Ready For Assign, Ready For Marketing
-- When profile is complete -> Ready For Assign; when recruiter assigned -> Ready For Marketing; when first submission -> In Marketing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Ready For Assign' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'candidate_status')) THEN
    ALTER TYPE candidate_status ADD VALUE 'Ready For Assign';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Ready For Marketing' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'candidate_status')) THEN
    ALTER TYPE candidate_status ADD VALUE 'Ready For Marketing';
  END IF;
END $$;
