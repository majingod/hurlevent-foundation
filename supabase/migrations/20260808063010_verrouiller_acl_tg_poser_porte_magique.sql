-- D54-bis (s382) — verrouillage de l'ACL de tg_poser_porte_magique().
-- Mesuré après 20260808062934 : proacl = {postgres=X,anon=X,authenticated=X,service_role=X}.
-- Le REVOKE ALL FROM PUBLIC de la migration précédente n'a rien retiré à anon ni à
-- authenticated : ce sont des GRANT nominatifs re-posés par les DEFAULT PRIVILEGES
-- de Supabase sur le schéma public, pas l'héritage de PUBLIC.
-- Risque réel nul (une fonction RETURNS trigger n'est pas exposée par PostgREST),
-- mais la règle du projet est « REVOKE FROM PUBLIC, anon, authenticated PUIS GRANT ».
-- Cible : {postgres=X/postgres,service_role=X/postgres} — le trigger s'exécute par le
-- moteur, pas par un rôle appelant.
-- ⛔ REPLI : GRANT EXECUTE ON FUNCTION public.tg_poser_porte_magique() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.tg_poser_porte_magique() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_poser_porte_magique() FROM anon;
REVOKE ALL ON FUNCTION public.tg_poser_porte_magique() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tg_poser_porte_magique() TO service_role;
