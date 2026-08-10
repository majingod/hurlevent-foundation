-- s391 · Verrou ACL des oracles de lecture sans appelant client (C112, C113)
--
-- Ces 12 fonctions SECURITY DEFINER acceptent un uuid de personnage et
-- repondent sur ce personnage sans verifier qui appelle : un compte
-- authentifie quelconque pouvait lire l'etat d'un personnage tiers.
--
-- Mesure prealable (s391), 8 chemins d'appel :
--   fonctions : appelants tous SECURITY DEFINER propriete de postgres,
--               0 appelant INVOKER expose a authenticated ;
--   policies 0 (temoin 19) · vues 0 (temoin 12) · matviews 0 (aucune au
--   schema) · rules 0 (aucune au schema) · contraintes 0 (temoin 111) ·
--   defaults 0 (temoin 54) · index d'expression 0 (temoin 5) ;
--   front : 0 appel .rpc( sur les 12, types.ts exclu (genere).
--   Le client REIMPLEMENTE ces gates (moteurCreation/gates*.ts, portage 1:1).
--
-- Le privilege d'une fonction appelee depuis une fonction SECURITY DEFINER
-- se verifie contre le PROPRIETAIRE (C112) : aucun appelant n'a besoin du
-- grant a authenticated. Le correctif est donc un REVOKE, et non une garde
-- en corps : aucun CREATE OR REPLACE, aucun corps de fonction modifie,
-- aucune ACL ni option remise a zero.
--
-- REVOKE nomme a PUBLIC, anon ET authenticated : sur Supabase un REVOKE
-- FROM PUBLIC ne retire rien aux deux roles nominatifs (C102).
--
-- service_role et postgres sont CONSERVES sur les 12.
-- Repli d'un geste : GRANT EXECUTE ... TO authenticated.

REVOKE EXECUTE ON FUNCTION public.peut_acheter_competence(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_acheter_competence_noyau(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_acheter_trait_racial(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_acheter_sort(uuid, uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_acheter_priere(uuid, uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_acheter_recette(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_acheter_assemblage(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.peut_acheter_piege(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.personnage_inapte_magie(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.personnage_est_modifiable(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capturer_compo_personnage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculer_xp_valeurs(uuid, uuid, integer, integer, integer, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
