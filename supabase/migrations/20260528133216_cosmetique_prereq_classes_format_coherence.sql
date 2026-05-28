-- ============================================================================
-- Migration : Cosmétique — uniformisation préfixe "Classe X" + fix casse + dédup description
-- ============================================================================
-- Champs touchés :
--   - competences.niveaux[].prerequis (7 compétences, 8 occurrences)
--   - competences.niveaux[].description (Bonne santé : nettoyage duplication prereq)
--
-- Convention : DB autoritaire pour libellés cosmétiques (décision session 47).
-- Format cible : "Classe X" (X = Guerrier/Voleur/Mage/Prêtre) — option Hybride 2.
--
-- Audit pré-apply 5/5 surfaces : 0 référence dans RPCs/vues/contraintes/triggers/frontend.
--
-- Idempotence : chaque UPDATE utilise REPLACE sur niveaux::text. Si déjà appliqué,
-- la chaîne source n'existe plus → REPLACE no-op.
-- ============================================================================

-- 1. Bonne santé : Guerrier → Classe Guerrier + nettoyage duplication description
UPDATE competences
SET niveaux = REPLACE(
  REPLACE(
    niveaux::text,
    '"prerequis": "Guerrier"',
    '"prerequis": "Classe Guerrier"'
  ),
  '"description": "Prérequis : Guerrier. Chaque fois',
  '"description": "Chaque fois'
)::jsonb
WHERE nom = 'Bonne santé';

-- 2. Cachette secrète : Voleur → Classe Voleur
UPDATE competences
SET niveaux = REPLACE(
  niveaux::text,
  '"prerequis": "Voleur"',
  '"prerequis": "Classe Voleur"'
)::jsonb
WHERE nom = 'Cachette secrète';

-- 3. Défense Inflexible : niv 1 (Guerrier) + niv 2 (Guerrier, Défense Inflexible 1)
UPDATE competences
SET niveaux = REPLACE(
  REPLACE(
    niveaux::text,
    '"prerequis": "Guerrier, Défense Inflexible 1"',
    '"prerequis": "Classe Guerrier, Défense Inflexible 1"'
  ),
  '"prerequis": "Guerrier"',
  '"prerequis": "Classe Guerrier"'
)::jsonb
WHERE nom = 'Défense Inflexible';

-- 4. Discours du Commandement : Guerrier → Classe Guerrier
UPDATE competences
SET niveaux = REPLACE(
  niveaux::text,
  '"prerequis": "Guerrier"',
  '"prerequis": "Classe Guerrier"'
)::jsonb
WHERE nom = 'Discours du Commandement';

-- 5. Fouille rapide : Voleur → Classe Voleur
UPDATE competences
SET niveaux = REPLACE(
  niveaux::text,
  '"prerequis": "Voleur"',
  '"prerequis": "Classe Voleur"'
)::jsonb
WHERE nom = 'Fouille rapide';

-- 6. Poids Lourd : Guerrier → Classe Guerrier
UPDATE competences
SET niveaux = REPLACE(
  niveaux::text,
  '"prerequis": "Guerrier"',
  '"prerequis": "Classe Guerrier"'
)::jsonb
WHERE nom = 'Poids Lourd';

-- 7. Bâton de Sorcier : Classe mage → Classe Mage (fix casse)
UPDATE competences
SET niveaux = REPLACE(
  niveaux::text,
  '"prerequis": "Classe mage"',
  '"prerequis": "Classe Mage"'
)::jsonb
WHERE nom = 'Bâton de Sorcier';
