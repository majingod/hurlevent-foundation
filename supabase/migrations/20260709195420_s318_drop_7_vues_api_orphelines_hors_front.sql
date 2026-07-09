-- s318 : DROP des 7 vues API orphelines (aucun consommateur front ni DB, mesure live s318).
-- anon voit 0 ligne (pas de fuite). Defs recuperables via l'historique git des migrations
-- (vue_personnage_creation_complet : voir 20260709183800 ; les 6 autres : migrations d'origine).
-- Idempotent (DROP IF EXISTS). NE TOUCHE PAS les 6 vues du snapshot _figer_stele.
DROP VIEW IF EXISTS public.vue_personnages_admin;
DROP VIEW IF EXISTS public.vue_tableau_de_bord;
DROP VIEW IF EXISTS public.vue_xp_personnage;
DROP VIEW IF EXISTS public.vue_inscriptions_resumees;
DROP VIEW IF EXISTS public.vue_personnage_creation_complet;
DROP VIEW IF EXISTS public.vue_joueurs_complete;
DROP VIEW IF EXISTS public.vue_evenements_admin;
