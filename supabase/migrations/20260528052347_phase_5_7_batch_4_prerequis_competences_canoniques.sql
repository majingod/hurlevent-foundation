-- Sprint 5.7 Batch 4 — Alignement des prerequis textuels avec les noms canoniques DB
-- Cible : champ competences.niveaux[].prerequis (texte d'affichage uniquement)
-- Le champ competences.prerequis_competences (validation RPC) est déjà aligné, non touché.
-- Audit pré-apply (session 47) :
--   - Aucune référence dans sorts/prieres/effets_combat/sections_regles
--   - Aucune référence dans pg_proc/pg_views/pg_matviews
--   - Aucune référence dans pg_constraint/pg_trigger
--   - Aucune référence dans le repo hurlevent-foundation (audit CC, 0 occurrence)
-- 10 UPDATE idempotents (LIKE case-sensitive, chaînes source/cible distinctes)

-- Cat. A — Connaissance(s) singulier → pluriel + casse (post-PR #120)
UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Connaissance des Runes,', 'Connaissances des Runes,')::jsonb
WHERE niveaux::text LIKE '%Connaissance des Runes,%';

UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Connaissance des créatures', 'Connaissances des Créatures')::jsonb
WHERE niveaux::text LIKE '%Connaissance des créatures%';

UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Connaissance religion,', 'Connaissances des Religions,')::jsonb
WHERE niveaux::text LIKE '%Connaissance religion,%';

UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Connaissance criminelle 2', 'Connaissances Criminelles 2')::jsonb
WHERE niveaux::text LIKE '%Connaissance criminelle 2%';

-- Cat. B — Casse Herbes/Métaux
UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Connaissances des métaux communs', 'Connaissances des Métaux Communs')::jsonb
WHERE niveaux::text LIKE '%Connaissances des métaux communs%';

UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Connaissances des métaux rares', 'Connaissances des Métaux Rares')::jsonb
WHERE niveaux::text LIKE '%Connaissances des métaux rares%';

UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Connaissances des Herbes communes', 'Connaissances des Herbes Communes')::jsonb
WHERE niveaux::text LIKE '%Connaissances des Herbes communes%';

UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Connaissances des Herbes rares', 'Connaissances des Herbes Rares')::jsonb
WHERE niveaux::text LIKE '%Connaissances des Herbes rares%';

-- Cat. D — Premiers soins → Premiers Soins (décision session 47 : DB autoritaire pour libellés)
UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Premiers soins 1', 'Premiers Soins 1')::jsonb
WHERE niveaux::text LIKE '%Premiers soins 1%';

UPDATE competences
SET niveaux = REPLACE(niveaux::text, 'Premiers soins 2', 'Premiers Soins 2')::jsonb
WHERE niveaux::text LIKE '%Premiers soins 2%';
