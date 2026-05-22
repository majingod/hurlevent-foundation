-- ============================================================================
-- Sprint 5.5 — Phase B : Uniformisation noms "Connaissances" (pluriel + casse)
-- ============================================================================
--
-- Contexte : la base et le manuel des règles 2026 utilisent indifféremment
-- "Connaissance" (singulier, 5 compétences) et "Connaissances" (pluriel,
-- 6 compétences). De plus, la casse des adjectifs Communs/Rares variait
-- entre minuscule et majuscule.
--
-- Décision Fred (session 21) :
--  - Pluriel "Connaissances" partout (6/11 déjà au pluriel, moins de
--    changements).
--  - Casse cohérente : majuscule sur les adjectifs (Communs, Rares).
--
-- Le manuel papier sera réaligné en édition suivante (écart documenté).
--
-- Idempotence : les UPDATE n'affectent que les lignes correspondant aux
-- anciens noms ; rejouer la migration sera no-op.
--
-- Périmètre :
--  - Étape 1 : 6 UPDATE sur competences.nom
--  - Étape 2 : 3 REPLACE sur competences.prerequis_competences (jsonb)
--  - Étape 3 : 1 UPDATE sur sections_regles.contenu
--
-- NB : les textes d'affichage dans competences.niveaux[].prerequis (utilisés
-- uniquement pour l'UI, pas par le moteur) restent désalignés. Leur
-- nettoyage est reporté au Sprint 5.7 (refonte descriptions massives).
-- ============================================================================

-- =========================================================================
-- ÉTAPE 1 : Renommer les 6 compétences cibles
-- =========================================================================

UPDATE competences SET nom = 'Connaissances des Créatures'
WHERE nom = 'Connaissance des Créatures';

UPDATE competences SET nom = 'Connaissances des Gemmes Communes'
WHERE nom = 'Connaissance des Gemmes Communes';

UPDATE competences SET nom = 'Connaissances des Gemmes Rares'
WHERE nom = 'Connaissance des Gemmes Rares';

UPDATE competences SET nom = 'Connaissances des Métaux Communs'
WHERE nom = 'Connaissance des Métaux communs';

UPDATE competences SET nom = 'Connaissances des Métaux Rares'
WHERE nom = 'Connaissances des Métaux rares';

UPDATE competences SET nom = 'Connaissances des Runes'
WHERE nom = 'Connaissance des Runes';

-- =========================================================================
-- ÉTAPE 2 : Réaligner les prerequis_competences (jsonb structuré) qui
-- pointent vers les anciens noms. Le moteur compare c.nom au champ
-- competence_nom : ces UPDATE évitent toute rupture du chaînage prereq.
-- =========================================================================

UPDATE competences SET prerequis_competences =
  REPLACE(prerequis_competences::text, '"Connaissance des Runes"', '"Connaissances des Runes"')::jsonb
WHERE prerequis_competences::text LIKE '%"Connaissance des Runes"%';

UPDATE competences SET prerequis_competences =
  REPLACE(prerequis_competences::text, '"Connaissance des Métaux communs"', '"Connaissances des Métaux Communs"')::jsonb
WHERE prerequis_competences::text LIKE '%"Connaissance des Métaux communs"%';

UPDATE competences SET prerequis_competences =
  REPLACE(prerequis_competences::text, '"Connaissances des Métaux rares"', '"Connaissances des Métaux Rares"')::jsonb
WHERE prerequis_competences::text LIKE '%"Connaissances des Métaux rares"%';

-- =========================================================================
-- ÉTAPE 3 : Aligner sections_regles
-- (occurrence connue : section "Récolte de composantes sur les monstres",
-- visible côté joueur dans l'Encyclopédie)
-- =========================================================================

UPDATE sections_regles
SET contenu = REPLACE(contenu, 'Connaissance des Créatures', 'Connaissances des Créatures')
WHERE contenu LIKE '%Connaissance des Créatures%';
