-- s390 · Les recalculs déclenchés par trigger ne sont plus appelables par un joueur
--
-- [ORACLES-TRAITS-SANS-GARDE], premier volet : les ÉCRIVAINS.
--
-- recalculer_pv_max(uuid) et recalculer_ps_max(uuid) sont SECURITY DEFINER et
-- étaient exécutables par `authenticated` sans aucune garde d'appartenance dans
-- leur corps : un joueur connaissant l'uuid d'un tiers pouvait déclencher le
-- recalcul de la fiche de ce tiers. Dégât nul à l'état courant (mesuré le
-- 2026-08-10 : 114/114 personnages déjà conformes à la formule, donc recalcul
-- no-op), trou réel malgré tout.
--
-- MESURÉ AVANT (2026-08-10) — le grant à `authenticated` ne sert AUCUN
-- appelant légitime :
--   . appelants en base : 5 fonctions de trigger UNIQUEMENT, toutes SECURITY
--     DEFINER et propriété de `postgres` — elles n'ont pas besoin du grant,
--     le privilège se vérifie contre le propriétaire ;
--   . appelants hors du schéma public : 0 ;
--   . policies RLS, vues, vues matérialisées, règles, contraintes, DEFAULT,
--     expressions d'index : 0 (instrument attesté par témoins non vides) ;
--   . front : 0 appel `.rpc(` — le client réimplémente ces formules lui-même
--     (artifacts/arlor/src/moteurCreation/deriveurs.ts, calculerPvMax et
--     calculerPsMax, portage 1:1 annoncé en doc-comment).
--
-- recalculer_xp_personnage(uuid) rejoint le lot par HYGIÈNE, pas comme trou :
-- elle est SECURITY INVOKER (la RLS de personnages la protège déjà) mais elle
-- traînait des grants PUBLIC et anon qui ne servent aucun appelant.
--
-- C102 : sur Supabase, REVOKE ... FROM PUBLIC ne retire RIEN à anon ni à
-- authenticated — ce sont des grants nominatifs posés par les DEFAULT
-- PRIVILEGES du schéma public. Les trois rôles sont donc nommés un par un.
-- C'est exactement ce qui manquait au « suivi recommandé » de la migration
-- 20260708230510, qui n'envisageait qu'un REVOKE FROM PUBLIC et qui nommait
-- déjà ces deux fonctions.
--
-- AUCUN CREATE OR REPLACE : les corps ne bougent pas, donc aucune ACL ni
-- option de fonction n'est remise à zéro. Idempotent par nature.
--
-- REPLI, un geste :
--   GRANT EXECUTE ON FUNCTION public.recalculer_pv_max(uuid) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.recalculer_ps_max(uuid) TO authenticated;
--   GRANT EXECUTE ON FUNCTION public.recalculer_xp_personnage(uuid) TO PUBLIC;

REVOKE EXECUTE ON FUNCTION public.recalculer_pv_max(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.recalculer_ps_max(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.recalculer_xp_personnage(uuid)
  FROM PUBLIC, anon, authenticated;
