-- MOTEUR V2 / PR1 — table de config de LISTE (parallèle, 0 consumer prod, additif)
CREATE TABLE IF NOT EXISTS public.fiches_listes (
  categorie   text PRIMARY KEY,
  recherche   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  navigation  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  carte       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  annexes     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  mis_a_jour  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiches_listes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fiches_listes_lecture_publique ON public.fiches_listes;
CREATE POLICY fiches_listes_lecture_publique
  ON public.fiches_listes FOR SELECT USING (true);

DROP POLICY IF EXISTS fiches_listes_ecriture_admin ON public.fiches_listes;
CREATE POLICY fiches_listes_ecriture_admin
  ON public.fiches_listes FOR ALL USING (est_animateur_ou_admin());

COMMENT ON TABLE public.fiches_listes IS
  'MOTEUR V2 — config de LISTE par catégorie (recherche/navigation/carte/annexes). Sœur de fiches_schemas (config de FICHE). Consommée par ListeMoteur en PR2+.';
