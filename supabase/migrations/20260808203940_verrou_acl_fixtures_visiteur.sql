-- s384 — VERROUILLAGE DES ROUTES DE FIXTURES (vie privee / Loi 25)
--
-- CONSTAT (mesure s384) : 9 fonctions SECURITY DEFINER etaient exécutables par
-- PUBLIC et anon. Six d'entre elles lisent `personnages` en contournant la RLS
-- et publient race, XP disponible et composition complete de vrais joueurs.
-- Aucune n'a d'appelant applicatif : elles ne servent qu'a regenerer les
-- fixtures de test, geste d'atelier qui passe par MCP ou psql.
--
-- C102 : sur Supabase, `REVOKE ... FROM PUBLIC` ne retire RIEN a anon ni a
-- authenticated (GRANT nominatifs poses par les DEFAULT PRIVILEGES du schema
-- public). La revocation doit donc etre NOMINATIVE, role par role.
--
-- MESURE PREALABLE (consommateurs) : `etat_edition_personnage` est le seul
-- appelant applicatif du lot ; son appel est garde par `enabled: mode === "route"`
-- (FichePersonnageView.tsx) — le wizard visiteur monte la meme vue en
-- "wizard-preview" et n'appelle jamais la RPC. Retirer anon ne casse pas le
-- visiteur. Elle GARDE donc `authenticated`, les 8 autres non.
--
-- REPLI (un geste, par fonction) :
--   GRANT EXECUTE ON FUNCTION public.<nom>(<args>) TO anon, authenticated;
--
-- Idempotent : REVOKE et GRANT le sont nativement.

REVOKE ALL ON FUNCTION public.fixtures_visiteur_traits_raciaux() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_traits_raciaux() FROM anon;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_traits_raciaux() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_traits_raciaux() TO service_role;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_sorts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_sorts() FROM anon;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_sorts() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_sorts() TO service_role;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_prieres() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_prieres() FROM anon;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_prieres() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_prieres() TO service_role;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_recettes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_recettes() FROM anon;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_recettes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_recettes() TO service_role;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_pieges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_pieges() FROM anon;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_pieges() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_pieges() TO service_role;

REVOKE ALL ON FUNCTION public.fixtures_visiteur_assemblages() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_assemblages() FROM anon;
REVOKE ALL ON FUNCTION public.fixtures_visiteur_assemblages() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_visiteur_assemblages() TO service_role;

REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur() FROM anon;
REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_parite_visiteur() TO service_role;

REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur_type(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur_type(text) FROM anon;
REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur_type(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fixtures_parite_visiteur_type(text) TO service_role;

REVOKE ALL ON FUNCTION public.etat_edition_personnage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.etat_edition_personnage(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.etat_edition_personnage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.etat_edition_personnage(uuid) TO service_role;

COMMENT ON FUNCTION public.fixtures_visiteur_traits_raciaux() IS
  's384 : geste d''atelier, service_role SEUL. Lit personnages en DEFINER. '
  'Repli : GRANT EXECUTE ... TO anon, authenticated;';

COMMENT ON FUNCTION public.etat_edition_personnage(uuid) IS
  's384 : anon retire (aucun consommateur visiteur, appel garde par mode==="route"). '
  'Repli : GRANT EXECUTE ON FUNCTION public.etat_edition_personnage(uuid) TO anon;';
