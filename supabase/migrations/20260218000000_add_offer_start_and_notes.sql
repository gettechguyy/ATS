-- Add tentative start date and additional notes to offers
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS tentative_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS additional_notes text;

