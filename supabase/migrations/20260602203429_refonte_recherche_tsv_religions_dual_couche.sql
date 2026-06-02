-- refonte_recherche_tsv_religions_dual_couche
-- Recompose recherche_tsv : fondateur (B), lore_fiche + description_longue (C),
-- lore_manuel + rituels_manuel (D). Idempotent.
-- Helper IMMUTABLE requis car array_to_string est STABLE (interdit en colonne générée).

CREATE OR REPLACE FUNCTION public.immutable_array_to_string(arr text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path TO 'public'
AS $$ SELECT array_to_string(arr, ' ') $$;

DROP INDEX IF EXISTS public.religions_recherche_tsv_idx;

ALTER TABLE public.religions DROP COLUMN IF EXISTS recherche_tsv;

ALTER TABLE public.religions ADD COLUMN recherche_tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('french'::regconfig, COALESCE(nom, '')), 'A')
  || setweight(to_tsvector('french'::regconfig, COALESCE(dirigeant, '') || ' ' || COALESCE(fondateur, '')), 'B')
  || setweight(to_tsvector('french'::regconfig, COALESCE(description, '') || ' ' || COALESCE(lore_fiche, '') || ' ' || COALESCE(description_longue, '')), 'C')
  || setweight(to_tsvector('french'::regconfig, COALESCE(lore_manuel, '') || ' ' || COALESCE(public.immutable_array_to_string(rituels_manuel), '') || ' ' || COALESCE(pouvoir_symbole, '')), 'D')
) STORED;

CREATE INDEX IF NOT EXISTS religions_recherche_tsv_idx ON public.religions USING gin (recherche_tsv);
