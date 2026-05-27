-- Per-user theme / color palette preferences (JSON on profiles)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preferences jsonb;

COMMENT ON COLUMN public.profiles.theme_preferences IS 'User theme palette: presetId, primaryHue, accentHue, etc. NULL = app default.';
