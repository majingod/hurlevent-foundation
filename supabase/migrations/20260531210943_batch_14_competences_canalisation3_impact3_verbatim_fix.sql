-- Sprint 5.7 Batch 14 — Audit verbatim des compétences
-- 2 corrections validées (game design) sur niveaux[].description :
--   1) pretre / Canalisation 3 : retrait d'un paragraphe "herbes" hors-sujet
--      (erreur de copier-coller du Manuel, fidèlement recopiée en base).
--   2) guerrier / Compétence d'arme d'impact 3 : harmonisation "Berzerk" -> "Berserk"
--      (cohérence avec le nom de compétence "Berserk").
-- Idempotent (gardes LIKE), ordre du tableau niveaux préservé (WITH ORDINALITY).

-- 1) Canalisation 3 (prêtre) : retirer le paragraphe herbes
UPDATE competences
SET niveaux = (
  SELECT jsonb_agg(
           CASE WHEN (t.n->>'niveau')::int = 3
                THEN jsonb_set(t.n, '{description}',
                       to_jsonb(regexp_replace(t.n->>'description',
                         '\s*Avec cette compétence, le personnage connaît les périodes de maturité.*', '')))
                ELSE t.n END
           ORDER BY t.ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS t(n, ord))
WHERE categorie = 'pretre' AND nom = 'Canalisation'
  AND niveaux::text LIKE '%périodes de maturité%';

-- 2) Compétence d'arme d'impact 3 (guerrier) : Berzerk -> Berserk
UPDATE competences
SET niveaux = (
  SELECT jsonb_agg(
           CASE WHEN (t.n->>'niveau')::int = 3
                THEN jsonb_set(t.n, '{description}',
                       to_jsonb(replace(t.n->>'description', 'Berzerk', 'Berserk')))
                ELSE t.n END
           ORDER BY t.ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS t(n, ord))
WHERE categorie = 'guerrier' AND nom = 'Compétence d''arme d''impact'
  AND niveaux::text LIKE '%Berzerk%';
