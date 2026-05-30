-- ============================================================================
-- UNIFICATION-SOURCE-PRÉREQUIS — Phase 2, PR-2 : vue encyclopédie
-- Expose les libellés de prérequis assemblés (source structurée, format « Niv N »)
-- pour que l'encyclopédie cesse de lire la chaîne figée niveaux[].prerequis.
-- security_invoker=true : réplique l'accès que l'utilisateur a déjà sur competences.
-- ============================================================================
CREATE OR REPLACE VIEW public.vue_competences_encyclopedie
WITH (security_invoker = true) AS
SELECT c.*,
       assembler_prerequis_labels(c.id) AS prerequis_labels
FROM public.competences c;

GRANT SELECT ON public.vue_competences_encyclopedie TO anon, authenticated;
