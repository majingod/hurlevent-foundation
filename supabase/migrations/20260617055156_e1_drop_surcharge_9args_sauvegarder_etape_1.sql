-- WIZARD-REFONTE-UX — E1-ALIGNER-FONCTION-UNIQUE
-- PR1 (s214) a ajouté la surcharge sauvegarder_etape_1(... , p_brouillon boolean
-- DEFAULT false) sans retirer l'ancienne surcharge 9-args. Le front appelle sans
-- p_brouillon → PostgreSQL ne peut pas choisir entre les deux candidates
-- (« Could not choose the best candidate function ») et bloque l'étape 1.
-- On supprime l'ancienne surcharge 9-args : la 10-args, avec p_brouillon=false par
-- défaut, reproduit exactement l'ancien comportement (validation + avance
-- etape_creation 1→2 + log).
DROP FUNCTION IF EXISTS public.sauvegarder_etape_1(
  uuid, text, integer, integer, integer, boolean, uuid, text, text
);
