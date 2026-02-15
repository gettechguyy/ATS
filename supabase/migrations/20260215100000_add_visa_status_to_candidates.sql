-- Add visa_status column to candidates (OPT, H1B, GC, Citizen, Other)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS visa_status text DEFAULT 'Other';

UPDATE candidates SET visa_status = 'Other' WHERE visa_status IS NULL;
