-- Add team_lead to app_role enum
DO $$
BEGIN
  -- Only add if it doesn't already exist
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'team_lead') THEN
    ALTER TYPE app_role ADD VALUE 'team_lead';
  END IF;
END$$;

