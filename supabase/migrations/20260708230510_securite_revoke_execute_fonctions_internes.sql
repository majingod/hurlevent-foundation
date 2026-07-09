-- ============================================================================
-- Sécurité : retire l'EXECUTE public sur 8 fonctions internes sensibles
-- ============================================================================
--
-- CONTEXTE / FAILLE
-- Advisor Supabase : `anon_security_definer_function_executable`. Plusieurs
-- fonctions SECURITY DEFINER étaient exécutables par `anon`/`authenticated`
-- (grant PUBLIC par défaut) alors qu'elles :
--   1. ne vérifient NI l'identité (auth.uid) NI le rôle de l'appelant, et
--   2. ne sont censées être appelées QUE par d'autres fonctions internes.
--
-- Concrètement, un appel direct via l'API PostgREST (/rest/v1/rpc/<nom>) par un
-- visiteur permettait, entre autres :
--   - _purger_compte_interne(uuid)     -> supprimer N'IMPORTE QUEL compte
--   - _purger_profil_interne(uuid)     -> supprimer n'importe quel profil
--   - _purger_personnage_interne(uuid) -> supprimer n'importe quel personnage
--   - _figer_stele(...)                -> « tuer » un personnage / créer sa stèle
--   - attribuer_competences_gratuites_classe(...) -> modifier les compétences
--                                          d'un personnage arbitraire
--   - creer_notification(...) / creer_notification_staff(...) -> spam de
--                                          notifications à n'importe qui / au staff
--   - journaliser_changement_role(...) -> écrire de fausses lignes d'audit
--
-- POURQUOI LE REVOKE EST SÛR (aucune régression de fonctionnalité)
--   - Ces 8 fonctions ne sont JAMAIS appelées directement par le front
--     (vérifié : 0 occurrence de `.rpc('<nom>')` dans artifacts/ et lib/).
--   - Elles ne sont appelées qu'en INTERNE, par des fonctions SECURITY DEFINER
--     appartenant à `postgres` :
--       _purger_*_interne            <- purger_compte / creer_steles_et_supprimer
--       _figer_stele                 <- creer_demande_mort / creer_stele_directe /
--                                       creer_steles_et_supprimer
--       attribuer_competences_...    <- sauvegarder_etape_4
--       creer_notification           <- ~20 RPC (ajuster_banque_xp, approuver_*, …)
--       creer_notification_staff     <- creer_demande_mort / creer_demande_race /
--                                       creer_steles_et_supprimer
--       journaliser_changement_role  <- trigger proteger_profile_role()
--                                       (avant/après UPDATE de profiles.role)
--   - Une fonction SECURITY DEFINER s'exécute avec les droits de son
--     propriétaire (`postgres`), qui conserve l'EXECUTE implicite sur ses
--     propres objets même après REVOKE FROM PUBLIC. Les chaînes d'appel
--     internes continuent donc de fonctionner à l'identique.
--
-- NON CONCERNÉES (laissées ouvertes volontairement) :
--   - reouvrir_personnage / creer_demande_mort / creer_stele_directe /
--     creer_steles_et_supprimer : appelées par le front ET protégées en interne
--     (peut_editer_personnage / est_animateur_ou_admin).
--   - rechercher_encyclopedie : appelée par les pages PUBLIQUES /regles et
--     /encyclopedie -> doit rester exécutable par anon.
--
-- VALIDÉ par transaction annulée sur la prod : après REVOKE,
--   has_function_privilege('anon',  'creer_notification_staff', 'EXECUTE') = false
--   has_function_privilege('anon',  '_purger_compte_interne',   'EXECUTE') = false
--   has_function_privilege('authenticated','creer_notification','EXECUTE') = false
-- et le propriétaire (postgres) conserve l'accès (appels internes intacts).
--
-- Idempotent : REVOKE d'un droit déjà absent est un no-op.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.creer_notification_staff(text, text, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.creer_notification(text, text, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._purger_compte_interne(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._purger_profil_interne(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._purger_personnage_interne(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._figer_stele(uuid, text, uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.attribuer_competences_gratuites_classe(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.journaliser_changement_role(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- SUIVI RECOMMANDÉ (hors périmètre)
--   - creer_demande_race(uuid, text) : n'est appelée nulle part par le front et
--     ne vérifie pas l'appartenance du personnage. À auditer (feature morte ?
--     sinon ajouter une garde compte_voit_joueur) avant de l'exposer.
--   - Helpers de recalcul purement déclenchés par trigger (recalculer_pv_max,
--     recalculer_ps_max, sync_xp_personnage, trg_*) : un REVOKE FROM PUBLIC est
--     du pur nettoyage (les triggers n'ont pas besoin de grant EXECUTE).
-- ============================================================================
