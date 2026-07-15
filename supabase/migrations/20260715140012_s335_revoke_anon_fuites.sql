-- s335 [SEC-ANON] REVOKE anon sur 4 fonctions qui fuitaient au sol.
-- Mesuré s335 : anon obtient EXECUTE via PUBLIC (=X) ET via un grant explicite anon.
-- Il faut donc REVOKE de PUBLIC *et* de anon ; authenticated garde son grant explicite.
-- Aucune de ces 4 fonctions n'est appelée par un flux anon (helpers internes / chemin authentifié).
-- REVOKE est idempotent (rejouable sans erreur).
REVOKE EXECUTE ON FUNCTION public.nom_profil_principal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.role_du_profil(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verifier_prerequis_competences(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.etat_edition_personnage(uuid) FROM PUBLIC, anon;
