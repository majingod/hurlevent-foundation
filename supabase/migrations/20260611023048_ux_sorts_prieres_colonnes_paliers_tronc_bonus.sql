-- UX-SORTS-PRIERES volet 3 (PR-data) : colonnes dérivées du verbatim Manuel.
-- description reste la source de vérité INTACTE ; paliers / description_tronc / bonus_niveau sont dérivés.
ALTER TABLE public.sorts
  ADD COLUMN IF NOT EXISTS paliers jsonb,
  ADD COLUMN IF NOT EXISTS description_tronc text,
  ADD COLUMN IF NOT EXISTS bonus_niveau jsonb;

ALTER TABLE public.prieres
  ADD COLUMN IF NOT EXISTS paliers jsonb,
  ADD COLUMN IF NOT EXISTS description_tronc text,
  ADD COLUMN IF NOT EXISTS bonus_niveau jsonb;

COMMENT ON COLUMN public.sorts.paliers IS 'Dérivé de description : [{niveau, libelle, texte}] — libelle = verbatim Manuel (Niv. X / Niveau X / À partir du niveau X)';
COMMENT ON COLUMN public.sorts.description_tronc IS 'Dérivé de description : prose avant le premier palier, note (*) exclue';
COMMENT ON COLUMN public.sorts.bonus_niveau IS 'Dérivé de la note (*) : {texte, formule:{variable, seuil, increment, unite, gratuit, condition}|null}';
COMMENT ON COLUMN public.prieres.paliers IS 'Dérivé de description : [{niveau, libelle, texte}] — libelle = verbatim Manuel (Niv. X / Niveau X / À partir du niveau X)';
COMMENT ON COLUMN public.prieres.description_tronc IS 'Dérivé de description : prose avant le premier palier, note (*) exclue';
COMMENT ON COLUMN public.prieres.bonus_niveau IS 'Dérivé de la note (*) : {texte, formule:{variable, seuil, increment, unite, gratuit, condition}|null}';
