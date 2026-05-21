-- Phase 5.4a : Audit classes_requises — 6 cas évidents (prereq classe explicite dans le Manuel 2026)
--
-- Découverte session 20 : 51 compétences ont categorie ∈ {guerrier, voleur, mage, pretre}
-- mais classes_requises = NULL, ce qui permet à des persos d'autres classes d'acheter
-- ces compétences en niveau 1-2 (la règle "niveau max 2 hors-classe" est déjà appliquée
-- automatiquement via peut_acheter_competence, mais pour ces 6 compétences le manuel
-- impose explicitement "Prérequis : Guerrier" ou "Prérequis : Voleur" — donc accès total
-- bloqué hors-classe).
--
-- Vérifié manuellement contre Manuel des règles 2026 édition 6 mai 2026 :
-- - Bonne santé (ligne 1727)           : "Prérequis : Guerrier"
-- - Défense Inflexible (1926, 1940)    : "(Prérequis : Guerrier)"
-- - Discours du Commandement (1957)    : "Prérequis : Guerrier"
-- - Poids Lourd (2034)                 : "Prérequis : Guerrier"
-- - Cachette secrète (2206)            : "Prérequis : Voleur"
-- - Fouille rapide (2337)              : "Prérequis : Voleur"
--
-- Idempotence : filtre `classes_requises IS NULL` → 2e exécution = no-op.

UPDATE competences
   SET classes_requises = ARRAY['guerrier']
 WHERE nom IN ('Bonne santé', 'Défense Inflexible', 'Discours du Commandement', 'Poids Lourd')
   AND categorie = 'guerrier'
   AND classes_requises IS NULL;

UPDATE competences
   SET classes_requises = ARRAY['voleur']
 WHERE nom IN ('Cachette secrète', 'Fouille rapide')
   AND categorie = 'voleur'
   AND classes_requises IS NULL;
