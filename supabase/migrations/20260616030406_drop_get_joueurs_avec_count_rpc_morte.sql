-- Retire la RPC get_joueurs_avec_count : morte (aucun appelant front/DB, confirmé s201/s202).
-- Remplacée de facto par l'explorateur joueurs (vue_personnages_admin_complet + RPC dédiées).
DROP FUNCTION IF EXISTS public.get_joueurs_avec_count();
