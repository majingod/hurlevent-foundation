-- =====================================================================
-- Patch C3 — Stubs conditionnels pour vues de la baseline #3
-- =====================================================================
-- Contexte (F4 cleanup, mai 2026) :
-- La baseline #3 (20260420214843_baseline_security_invoker_vues.sql)
-- fait ALTER VIEW ... SET (security_invoker = true) sur 12 vues qui
-- n'existent pas dans 00000000000000_baseline_schema.sql. En prod elles
-- existent (créées avant le baseline_schema), donc l'ALTER passe.
-- En CI/db reset elles n'existent pas et la baseline #3 plante.
--
-- Ce patch crée des stubs minimaux SI ET SEULEMENT SI les vues n'existent
-- pas. En prod : no-op (toutes existent). En CI/db reset : 12 stubs créés.
--
-- Les vraies définitions de ces vues restent en prod et dans le baseline_schema
-- (à régénérer dans un futur chantier baseline_schema-regen pour éliminer
-- complètement cette dette).
-- =====================================================================

DO $patch_c3$
DECLARE
  v_vues text[] := ARRAY[
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
  v_vue text;
BEGIN
  FOREACH v_vue IN ARRAY v_vues LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_views
      WHERE schemaname = 'public' AND viewname = v_vue
    ) THEN
      EXECUTE format(
        'CREATE VIEW public.%I AS SELECT NULL::integer AS placeholder WHERE false',
        v_vue
      );
      RAISE NOTICE 'Stub créé : %', v_vue;
    END IF;
  END LOOP;
END
$patch_c3$;
