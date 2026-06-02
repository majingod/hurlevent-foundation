-- religion_dual_couche_schema
-- Architecture double couche (Fiche / Manuel) — colonnes seules, aucune data ici (voir PR-B).
-- Idempotent.

ALTER TABLE public.religions
  ADD COLUMN IF NOT EXISTS lore_fiche      text,
  ADD COLUMN IF NOT EXISTS rituels_fiche   text[],
  ADD COLUMN IF NOT EXISTS lore_manuel     text,
  ADD COLUMN IF NOT EXISTS rituels_manuel  text[];

COMMENT ON COLUMN public.religions.lore_fiche     IS 'Couche Fiche : resume cure du lore (prose courte).';
COMMENT ON COLUMN public.religions.rituels_fiche  IS 'Couche Fiche : rituels concis, 1:1 avec rituels_manuel (meme nombre d''items).';
COMMENT ON COLUMN public.religions.lore_manuel    IS 'Couche Manuel : lore verbatim du Manuel 2026.';
COMMENT ON COLUMN public.religions.rituels_manuel IS 'Couche Manuel : rituels verbatim du Manuel 2026.';
