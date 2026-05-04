-- ============================================================================
-- PHASE 1.1 — CONTRAINTES CHECK MANQUANTES SUR personnages
-- ============================================================================
-- Date     : 2026-05-03
-- Contexte : Reconstruction data-first du créateur de personnage.
--            Tables personnage_* vides, donc on peut imposer le nouveau
--            format JSON sans risque de violation existante.
-- ============================================================================

-- 1. xp_total >= 0
ALTER TABLE personnages
  ADD CONSTRAINT personnages_xp_total_positif
  CHECK (xp_total >= 0);

-- 2. xp_depense >= 0
ALTER TABLE personnages
  ADD CONSTRAINT personnages_xp_depense_positif
  CHECK (xp_depense >= 0);

-- 3. xp_depense <= xp_total
--    On ne peut pas dépenser plus d'XP qu'on en a gagné.
ALTER TABLE personnages
  ADD CONSTRAINT personnages_xp_depense_max
  CHECK (xp_depense <= xp_total);

-- 4. nom : si présent (non NULL), au moins 2 caractères non-blancs
--    NULL est autorisé pour permettre la création progressive (étape 1).
ALTER TABLE personnages
  ADD CONSTRAINT personnages_nom_longueur
  CHECK (nom IS NULL OR char_length(trim(nom)) >= 2);

-- 5. Format JSON traits_raciaux_choisis (NOUVEAU FORMAT)
--    Format attendu : [{"trait_id": "uuid", "est_gratuit": true|false, "xp_depense": int>=0}, ...]
--    NULL et tableau vide [] sont autorisés.
--
--    PostgreSQL n'autorise pas les sous-requêtes dans CHECK, donc on passe
--    par une fonction IMMUTABLE qui parcourt le tableau JSONB.
CREATE OR REPLACE FUNCTION valider_format_traits_raciaux(p_traits jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- NULL est autorisé (état initial du personnage)
  IF p_traits IS NULL THEN
    RETURN true;
  END IF;

  -- Doit être un tableau JSON
  IF jsonb_typeof(p_traits) != 'array' THEN
    RETURN false;
  END IF;

  -- Tableau vide autorisé
  IF jsonb_array_length(p_traits) = 0 THEN
    RETURN true;
  END IF;

  -- Chaque élément doit avoir trait_id (string), est_gratuit (bool), xp_depense (int >= 0)
  RETURN NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_traits) AS elem
    WHERE NOT (elem ? 'trait_id')
       OR NOT (elem ? 'est_gratuit')
       OR NOT (elem ? 'xp_depense')
       OR jsonb_typeof(elem->'trait_id') != 'string'
       OR jsonb_typeof(elem->'est_gratuit') != 'boolean'
       OR jsonb_typeof(elem->'xp_depense') != 'number'
       OR (elem->>'xp_depense')::int < 0
  );
END;
$$;

COMMENT ON FUNCTION valider_format_traits_raciaux(jsonb) IS
  'Helper IMMUTABLE pour la contrainte CHECK du nouveau format de traits_raciaux_choisis. Format attendu : [{"trait_id": uuid, "est_gratuit": bool, "xp_depense": int>=0}].';

ALTER TABLE personnages
  ADD CONSTRAINT personnages_traits_raciaux_format
  CHECK (valider_format_traits_raciaux(traits_raciaux_choisis));
