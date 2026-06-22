-- Fix CIBLE du journal staff : résoudre le nom de cible pour TOUS les cible_type,
-- pas seulement 'personnage'. banque -> nom du profil ; compte -> nom_affichage du compte.
-- Idempotent (CREATE OR REPLACE). security_invoker préservé.
CREATE OR REPLACE VIEW public.vue_journal_staff
WITH (security_invoker = true) AS
SELECT
  j.id,
  j.acteur_id,
  j.acteur_role,
  j.cible_type,
  j.cible_id,
  j.action,
  j.details,
  j.created_at,
  public.nom_profil_principal(j.acteur_id) AS acteur_nom,
  CASE j.cible_type
    WHEN 'personnage' THEN (SELECT p.nom            FROM public.personnages   p  WHERE p.id  = j.cible_id)
    WHEN 'banque'     THEN (SELECT pj.nom           FROM public.profils_joueur pj WHERE pj.id = j.cible_id)
    WHEN 'compte'     THEN (SELECT pr.nom_affichage FROM public.profiles      pr WHERE pr.id = j.cible_id)
    ELSE NULL
  END AS cible_nom
FROM public.journal_audit j
WHERE j.acteur_role <> 'proprietaire'::text;
