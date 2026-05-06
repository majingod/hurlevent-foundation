-- ============================================================================
-- ALTER VIEW security_invoker — version tolérante aux vues inexistantes
-- ============================================================================
-- Contexte : ces 12 vues sont définies par le baseline du 3 mai
-- (20260503000000_baseline_pre_reconstruction.sql). En prod, elles existaient
-- déjà au moment où cette migration a tourné (créées par Lovable AI). En
-- Supabase Preview qui rejoue tout depuis zéro, elles n'existent pas encore
-- ici → on doit ignorer les vues absentes pour ne pas planter Preview.
--
-- Le baseline du 3 mai recréera les vues avec security_invoker déjà appliqué
-- (via WITH (security_invoker = true) dans CREATE OR REPLACE VIEW), donc
-- cette migration devient effectivement no-op si les vues n'existent pas
-- encore. En prod, la migration reste no-op aussi (déjà appliquée par version).
-- ============================================================================

DO $$
DECLARE
  v_view text;
  v_views text[] := ARRAY[
    'vue_artisanat_etat',
    'vue_artisanat_quotas',
    'vue_cercles_disponibles',
    'vue_competences_maitre_attente',
    'vue_domaines_disponibles',
    'vue_inscriptions_par_evenement',
    'vue_inscriptions_resumees',
    'vue_joueurs_complete',
    'vue_joueurs_maitres',
    'vue_personnage_etat',
    'vue_prochain_evenement',
    'vue_verrou_competences'
  ];
BEGIN
  FOREACH v_view IN ARRAY v_views LOOP
    IF EXISTS (
      SELECT 1 FROM pg_views
      WHERE schemaname = 'public' AND viewname = v_view
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v_view);
    END IF;
  END LOOP;
END $$;
