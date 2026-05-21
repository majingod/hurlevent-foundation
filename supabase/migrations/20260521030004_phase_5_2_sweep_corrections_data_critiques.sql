-- =============================================================
-- Sprint 5.2 — Sweep corrections data critiques (Phase 5)
-- 6 corrections d'alignement Manuel des règles 2026 (édition 6 mai 2026)
--
-- Tables touchées:
--   categories_creatures (2 UPDATE)  -- Nature→Forêt, Profondeurs→Souterrains
--   competences         (2 UPDATE jsonb prerequis_competences)
--   effets_combat       (1 INSERT)   -- "Sans âme" (description verbatim manuel)
--   sorts               (1 UPDATE)   -- Inspiration spirituel : ajout § objets magiques
--   assemblages_runes   (1 UPDATE)   -- Assemblage de durabilité : description verbatim
--
-- Idempotente: tous les WHERE filtres garantissent qu'une 2e exécution = no-op
-- =============================================================

SET search_path TO 'public';

-- 1) categories_creatures: Nature → Forêt
UPDATE categories_creatures SET nom = 'Forêt' WHERE nom = 'Nature';

-- 2) categories_creatures: Profondeurs → Souterrains
UPDATE categories_creatures SET nom = 'Souterrains' WHERE nom = 'Profondeurs';

-- 3) competences.Connaissances des Herbes Rares: ajout prérequis
UPDATE competences
SET prerequis_competences = jsonb_build_object(
  '1', jsonb_build_array(
    jsonb_build_object('niveau_min', 1, 'competence_nom', 'Connaissances des Herbes Communes')
  )
)
WHERE nom = 'Connaissances des Herbes Rares' AND prerequis_competences IS NULL;

-- 4) competences.Connaissances des Métaux rares: ajout prérequis
UPDATE competences
SET prerequis_competences = jsonb_build_object(
  '1', jsonb_build_array(
    jsonb_build_object('niveau_min', 1, 'competence_nom', 'Connaissance des Métaux communs')
  )
)
WHERE nom = 'Connaissances des Métaux rares' AND prerequis_competences IS NULL;

-- 5) effets_combat: INSERT "Sans âme" (description verbatim manuel p.5 lexique)
INSERT INTO effets_combat (nom, type, source, duree, conditions, description)
SELECT 'Sans âme', 'mort', 'les_deux', '10 min', 'Perte d''âme',
       'Un personnage privé d''âme est considéré comme étant dans un état critique. '
    || 'Lorsqu''un personnage sans âme tombe à 0 point de vie (PV), il ne meurt pas '
    || 'immédiatement. Il y a un délai de 10 minutes, durant lequel il peut encore '
    || 'être affecté par certains effets. À l''issue de ce délai, si aucune '
    || 'intervention appropriée n''a été effectuée, le personnage meurt définitivement.'
WHERE NOT EXISTS (SELECT 1 FROM effets_combat WHERE nom = 'Sans âme');

-- 6a) sorts.Inspiration spirituel: ajout paragraphe objets magiques
UPDATE sorts
SET description = description || E'\n\n'
  || 'Si ce sort est utilisé dans le cadre de la création ou de l''activation d''un '
  || 'objet magique/parchemin, le créateur paie le coût de spiritualité pour lancer '
  || 'le sort. La quantité de mana fournie par l''objet à la cible est alors puisée '
  || 'dans la réserve de points de spiritualité de l''utilisateur de l''objet au '
  || 'moment de son utilisation afin d''être transférés à la cible.'
WHERE nom = 'Inspiration spirituel'
  AND description NOT LIKE '%objet magique/parchemin%';

-- 6b) assemblages_runes.Assemblage de durabilité: description verbatim manuel
UPDATE assemblages_runes
SET description = 'Utilisée largement comme bénédiction sur les instruments de minage '
  || 'des peuples nains, cette rune sert à trouver sa voie dans le domaine de la '
  || 'guerre rapidement. Lorsque cet assemblage est activé, le bouclier ou l''arme '
  || 'qui le porte devient indestructible pour une durée de 30 minutes. Cet '
  || 'assemblage, une fois dessiné, consume 5 points de spiritualité au traceur. '
  || 'S''il possède la maîtrise des assemblages, le Marqueur peut consumer 7 points '
  || 'de spiritualités pour rendre son bouclier tellement fort qu''il permet de '
  || 'faire un désengagement (repoussé 1 mètre) en plus de rendre son arme '
  || 'indestructible. Cet assemblage dure 30 minutes et un seul désengagement est '
  || 'possible par assemblage de durabilité activé.'
WHERE nom = 'Assemblage de durabilité' AND LENGTH(description) < 500;
