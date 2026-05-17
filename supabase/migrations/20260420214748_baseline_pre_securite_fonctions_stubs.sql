-- =====================================================================
-- Patch C2 — Stubs conditionnels pour fonctions de la baseline #2
-- =====================================================================
-- Contexte (F4 cleanup, mai 2026) :
-- La baseline #2 (20260420214749_baseline_securite_profiles_vues_admin.sql)
-- fait REVOKE/GRANT sur 7 fonctions qui n'existent pas dans
-- 00000000000000_baseline_schema.sql. En prod ces fonctions existent (créées
-- en amont du baseline_schema), donc les REVOKE/GRANT passent. En CI ou lors
-- d'un `supabase db reset`, elles n'existent pas → la baseline #2 plante avec
--   ERROR: function public.attribuer_xp_evenement(uuid, integer) does not exist
--
-- Ce patch crée des stubs minimaux SI ET SEULEMENT SI les fonctions n'existent
-- pas déjà. En prod : no-op (toutes les fonctions existent). En CI/db reset :
-- 7 stubs créés avec la signature exacte attendue par la baseline #2.
--
-- Les vraies versions des fonctions sont (re)créées plus tard dans les
-- migrations qui suivent (phase 1.3 historique_xp pour 2 d'entre elles).
-- Les 5 autres fonctions (verrouiller_*, deverrouiller_*, archiver_*,
-- approuver_maitre_competence, marquer_absent) restent des stubs en environnement
-- reset — dette technique à éliminer via un chantier baseline_schema-regen.
-- =====================================================================

DO $patch_c2$
BEGIN
  -- 1. attribuer_xp_evenement(uuid, integer)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'attribuer_xp_evenement'
  ) THEN
    EXECUTE $stub$
      CREATE FUNCTION public.attribuer_xp_evenement(p_inscription_id uuid, p_xp_montant integer)
      RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb'
    $stub$;
    RAISE NOTICE 'Stub créé : attribuer_xp_evenement(uuid, integer)';
  END IF;

  -- 2. donner_xp_bonus(uuid, integer, text)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'donner_xp_bonus'
  ) THEN
    EXECUTE $stub$
      CREATE FUNCTION public.donner_xp_bonus(p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL)
      RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb'
    $stub$;
    RAISE NOTICE 'Stub créé : donner_xp_bonus(uuid, integer, text)';
  END IF;

  -- 3. verrouiller_personnage(uuid)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'verrouiller_personnage'
  ) THEN
    EXECUTE $stub$
      CREATE FUNCTION public.verrouiller_personnage(p_personnage_id uuid)
      RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb'
    $stub$;
    RAISE NOTICE 'Stub créé : verrouiller_personnage(uuid)';
  END IF;

  -- 4. deverrouiller_personnage(uuid)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'deverrouiller_personnage'
  ) THEN
    EXECUTE $stub$
      CREATE FUNCTION public.deverrouiller_personnage(p_personnage_id uuid)
      RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb'
    $stub$;
    RAISE NOTICE 'Stub créé : deverrouiller_personnage(uuid)';
  END IF;

  -- 5. archiver_personnage(uuid)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'archiver_personnage'
  ) THEN
    EXECUTE $stub$
      CREATE FUNCTION public.archiver_personnage(p_personnage_id uuid)
      RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb'
    $stub$;
    RAISE NOTICE 'Stub créé : archiver_personnage(uuid)';
  END IF;

  -- 6. approuver_maitre_competence(uuid)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'approuver_maitre_competence'
  ) THEN
    EXECUTE $stub$
      CREATE FUNCTION public.approuver_maitre_competence(p_personnage_competence_id uuid)
      RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb'
    $stub$;
    RAISE NOTICE 'Stub créé : approuver_maitre_competence(uuid)';
  END IF;

  -- 7. marquer_absent(uuid)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'marquer_absent'
  ) THEN
    EXECUTE $stub$
      CREATE FUNCTION public.marquer_absent(p_inscription_id uuid)
      RETURNS jsonb LANGUAGE sql AS 'SELECT ''{}''::jsonb'
    $stub$;
    RAISE NOTICE 'Stub créé : marquer_absent(uuid)';
  END IF;
END
$patch_c2$;
