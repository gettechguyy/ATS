-- Case-insensitive A–Z ordering: plain text sort uses byte order (so "Z" can sort before "a").
-- Generated columns mirror lower(trim(...)) for ORDER BY.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name_sort text
  GENERATED ALWAYS AS (lower(trim(coalesce(full_name, '')))) STORED;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS first_name_sort text
  GENERATED ALWAYS AS (lower(trim(coalesce(first_name, '')))) STORED;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS last_name_sort text
  GENERATED ALWAYS AS (lower(trim(coalesce(last_name, '')))) STORED;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS name_sort text
  GENERATED ALWAYS AS (lower(trim(coalesce(name, '')))) STORED;

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS full_name_sort text
  GENERATED ALWAYS AS (lower(trim(coalesce(full_name, '')))) STORED;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS client_name_sort text
  GENERATED ALWAYS AS (lower(trim(coalesce(client_name, '')))) STORED;
