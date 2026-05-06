-- ============================================================================
-- PHASE 1.2 — COHÉRENCE STRICTE est_croyant <-> religion_id
-- ============================================================================
-- Date     : 2026-05-03
-- Contexte : La contrainte existante chk_croyant_religion_coherence est
--            incomplète : elle empêche un non-croyant d'avoir une religion,
--            mais autorise un croyant SANS religion.
--            On la remplace par une version bidirectionnelle stricte.
--
-- Règle métier finale :
--   est_croyant = TRUE  <=> religion_id IS NOT NULL
--   est_croyant = FALSE <=> religion_id IS NULL
-- ============================================================================

-- Drop l'ancienne contrainte incomplète
ALTER TABLE personnages
  DROP CONSTRAINT IF EXISTS chk_croyant_religion_coherence;

-- Nouvelle version bidirectionnelle :
-- est_croyant doit toujours refléter la présence/absence d'une religion
ALTER TABLE personnages
  ADD CONSTRAINT chk_croyant_religion_coherence
  CHECK (est_croyant = (religion_id IS NOT NULL));

COMMENT ON CONSTRAINT chk_croyant_religion_coherence ON personnages IS
  'Cohérence stricte : un personnage est croyant SI ET SEULEMENT SI il a une religion. est_croyant = TRUE <=> religion_id IS NOT NULL.';
