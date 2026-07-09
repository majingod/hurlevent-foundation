-- ============================================================================
-- Vérification : les 8 fonctions internes ne sont plus exécutables par
-- anon / authenticated, et restent appelables par leur propriétaire (postgres).
-- ============================================================================
--
-- À exécuter APRÈS la migration
-- 20260708230510_securite_revoke_execute_fonctions_internes.sql :
--
--   psql "$DATABASE_URL" -f supabase/tests/20260708_verif_revoke_fonctions_internes.sql
--
-- Déterministe, sans écriture. Lève une exception à la première violation ;
-- affiche « OK — … » si tout est vert. Ré-exécutable.
-- ============================================================================

DO $$
DECLARE
  v_cibles text[] := ARRAY[
    'public.creer_notification_staff(text,text,uuid)',
    'public.creer_notification(text,text,uuid,uuid,uuid,text)',
    'public._purger_compte_interne(uuid)',
    'public._purger_profil_interne(uuid)',
    'public._purger_personnage_interne(uuid)',
    'public._figer_stele(uuid,text,uuid,text,boolean)',
    'public.attribuer_competences_gratuites_classe(uuid,jsonb)',
    'public.journaliser_changement_role(uuid,uuid,text,text,text)'
  ];
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY v_cibles LOOP
    -- anon ne doit PLUS pouvoir exécuter
    IF has_function_privilege('anon', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'ECHEC : anon peut encore exécuter %', v_sig;
    END IF;
    -- authenticated ne doit PLUS pouvoir exécuter
    IF has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'ECHEC : authenticated peut encore exécuter %', v_sig;
    END IF;
    -- le propriétaire (postgres) doit CONSERVER l'accès (appels internes intacts)
    IF NOT has_function_privilege('postgres', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'ECHEC : postgres a perdu EXECUTE sur % (appels internes cassés)', v_sig;
    END IF;
  END LOOP;

  RAISE NOTICE 'OK — 8 fonctions internes fermées à anon/authenticated, propriétaire intact.';
END $$;

-- Garde-fou : rechercher_encyclopedie (utilisée par les pages publiques)
-- doit RESTER exécutable par anon.
DO $$
BEGIN
  IF NOT has_function_privilege('anon',
       'public.rechercher_encyclopedie(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ECHEC : anon a perdu rechercher_encyclopedie (pages publiques cassées)';
  END IF;
  RAISE NOTICE 'OK — rechercher_encyclopedie reste public.';
END $$;
