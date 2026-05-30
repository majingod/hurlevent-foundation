-- Phase 3 PR-4 : abandon de la chaîne figée niveaux[].prerequis.
-- La source unique des prérequis est désormais la colonne structurée
-- prerequis_competences (gating via peut_acheter_competence /
-- verifier_prerequis_competences) et l'affichage via assembler_prerequis_labels.
-- Cette clé figée n'est plus lue par aucun consommateur (DB ni frontend).
-- Idempotent : ne touche que les lignes ayant encore la clé.
UPDATE competences
SET niveaux = (
  SELECT jsonb_agg(elem - 'prerequis' ORDER BY ord)
  FROM jsonb_array_elements(niveaux) WITH ORDINALITY AS t(elem, ord)
)
WHERE jsonb_typeof(niveaux) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(niveaux) e WHERE e ? 'prerequis'
  );
