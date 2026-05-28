-- ============================================================================
-- Migration : Cosmétique — nettoyage des préfixes "(Prérequis : ...)" en début de description
-- ============================================================================
-- Champs touchés :
--   - competences.niveaux[].description (6 occurrences dans 4 compétences)
--
-- Convention : DB autoritaire pour libellés cosmétiques (décision session 47).
-- Les prereqs structurés vivent dans :
--   - classes_requises (text[])
--   - prerequis_competences (jsonb structuré, validation RPC)
--   - niveaux[].prerequis (texte d'affichage)
-- La description ne doit PAS répéter ces infos.
--
-- Cas isolé déjà traité session 48 : Bonne santé ("Prérequis : Guerrier. ...").
-- Ce nettoyage complète la cohérence pour les 4 autres compétences qui avaient
-- la duplication sous forme parenthésée "(Prérequis : ...)".
--
-- Audit pré-apply 5/5 surfaces :
--   - RPCs : 0 référence au pattern "(Prérequis"
--   - Vues, contraintes, triggers : 0 référence
--   - Frontend (Etape5_Competences_V2.tsx, CardTemplates.tsx) : 0 référence
--
-- Idempotence : chaque UPDATE utilise REPLACE sur niveaux::text. Si déjà appliqué,
-- la chaîne source n'existe plus → REPLACE no-op.
-- ============================================================================

-- 1. Bravoure (niv 1) : "(Prérequis : Classe Guerrier) " → ""
UPDATE competences
SET niveaux = REPLACE(
  niveaux::text,
  '"description": "(Prérequis : Classe Guerrier) ',
  '"description": "'
)::jsonb
WHERE nom = 'Bravoure';

-- 2. Charge (niv 1) : "(Prérequis : Classe Guerrier, Botte secrète 1) " → ""
UPDATE competences
SET niveaux = REPLACE(
  niveaux::text,
  '"description": "(Prérequis : Classe Guerrier, Botte secrète 1) ',
  '"description": "'
)::jsonb
WHERE nom = 'Charge';

-- 3. Compétence d'arme à deux mains (niv 1) : "(Prérequis : Classe Guerrier) " → ""
UPDATE competences
SET niveaux = REPLACE(
  niveaux::text,
  '"description": "(Prérequis : Classe Guerrier) ',
  '"description": "'
)::jsonb
WHERE nom = 'Compétence d''arme à deux mains';

-- 4. Compétence d'arme à la hache (niv 1, 2, 3) : 3 préfixes en 1 UPDATE
UPDATE competences
SET niveaux = REPLACE(
  REPLACE(
    REPLACE(
      niveaux::text,
      '"description": "(Prérequis : Botte secrète 1) ',
      '"description": "'
    ),
    '"description": "(Prérequis : Botte secrète 2) ',
    '"description": "'
  ),
  '"description": "(Prérequis : Botte secrète 3) ',
  '"description": "'
)::jsonb
WHERE nom = 'Compétence d''arme à la hache';
