-- ============================================================================
-- Vérification anti-fuite : les 29 vues doivent être en security_invoker
-- et rester inaccessibles à `anon` pour les données privées.
-- ============================================================================
--
-- À exécuter APRÈS la migration
-- 20260708213754_securite_vues_security_invoker_anti_fuite.sql, sur une branche
-- Supabase ou en local :
--
--   psql "$DATABASE_URL" -f supabase/tests/20260708_verif_security_invoker_vues.sql
--
-- Le script est déterministe et sans dépendance aux données :
--   - il n'écrit rien (aucun COMMIT) ;
--   - il lève une exception (donc sort en erreur) à la première assertion violée ;
--   - s'il affiche « OK — … » à la fin, tout est vert.
--
-- Ré-exécutable autant de fois que voulu.
-- ============================================================================

DO $$
DECLARE
  v_attendues text[] := ARRAY[
    'vue_fiche_personnage','vue_personnage_etat','vue_personnage_creation_complet',
    'vue_personnages_joueur','vue_xp_personnage','vue_competences_personnage',
    'vue_sorts_personnage','vue_prieres_personnage','vue_recettes_personnage',
    'vue_assemblages_personnage','vue_artisanat_etat','vue_artisanat_quotas',
    'vue_domaines_disponibles','vue_banque_joueur','vue_inscriptions_par_evenement',
    'vue_inscriptions_resumees','vue_tableau_de_bord','vue_personnages_admin',
    'vue_personnages_admin_complet','vue_stats_admin','vue_evenements_admin',
    'vue_competences_maitre_admin','vue_demandes_morts_attente',
    'vue_demandes_races_attente','vue_cimetiere','vue_prochain_evenement',
    'vue_evenements_publies','vue_competences_encyclopedie','vue_traits_par_race'
  ];
  v text;
  v_ok boolean;
BEGIN
  -- (1) Structurel : chaque vue cible porte bien security_invoker=on/true.
  FOREACH v IN ARRAY v_attendues LOOP
    SELECT EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v AND c.relkind = 'v'
        AND c.reloptions IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(c.reloptions) o
          WHERE o IN ('security_invoker=on','security_invoker=true')
        )
    ) INTO v_ok;

    IF NOT v_ok THEN
      RAISE EXCEPTION 'ECHEC : la vue public.% n''est PAS en security_invoker', v;
    END IF;
  END LOOP;

  -- (2) Garde globale : plus AUCUNE vue definer accordée à anon ne doit subsister.
  SELECT count(*) = 0 INTO v_ok
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'v'
    AND has_table_privilege('anon', c.oid, 'SELECT')
    AND (c.reloptions IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(c.reloptions) o WHERE o LIKE 'security_invoker=%'));

  IF NOT v_ok THEN
    RAISE EXCEPTION 'ECHEC : il reste des vues SECURITY DEFINER lisibles par anon';
  END IF;

  RAISE NOTICE 'OK (structurel) — 29 vues en security_invoker, aucune vue definer ouverte a anon.';
END $$;

-- (3) Comportemental : sous le rôle `anon`, les vues privées renvoient 0 ligne,
--     quelles que soient les données (aucune policy anon sur personnages /
--     inscriptions). Déterministe même sur une base peuplée.
BEGIN;
  SET LOCAL role anon;
  DO $$
  DECLARE n_fiche int; n_insc int; n_tab int; n_admin int;
  BEGIN
    SELECT count(*) INTO n_fiche FROM public.vue_fiche_personnage;
    SELECT count(*) INTO n_insc  FROM public.vue_inscriptions_par_evenement;
    SELECT count(*) INTO n_tab   FROM public.vue_tableau_de_bord;
    SELECT count(*) INTO n_admin FROM public.vue_personnages_admin;

    IF n_fiche <> 0 OR n_insc <> 0 OR n_tab <> 0 OR n_admin <> 0 THEN
      RAISE EXCEPTION
        'ECHEC (fuite anon) : fiche=%, inscriptions=%, tableau=%, admin=% (attendu 0 partout)',
        n_fiche, n_insc, n_tab, n_admin;
    END IF;

    RAISE NOTICE 'OK (comportemental) — anon ne lit aucune donnee privee (fiche/inscriptions/tableau/admin = 0).';
  END $$;
ROLLBACK;

-- (4) Contenu public toujours ouvert : anon conserve le privilège SELECT sur les
--     vues publiques (le RLS des tables de base les garde lisibles).
DO $$
DECLARE v text; v_pub text[] := ARRAY[
  'vue_prochain_evenement','vue_evenements_publies',
  'vue_competences_encyclopedie','vue_traits_par_race','vue_cimetiere'];
BEGIN
  FOREACH v IN ARRAY v_pub LOOP
    IF NOT has_table_privilege('anon', ('public.'||v)::regclass, 'SELECT') THEN
      RAISE EXCEPTION 'ECHEC : anon a perdu SELECT sur la vue publique public.%', v;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK (public) — les vues de contenu public restent accessibles a anon.';
END $$;

-- Si les 4 blocs ont affiché « OK … » sans exception, la correction est validée.
