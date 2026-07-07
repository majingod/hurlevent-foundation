-- Restaure security_invoker sur vue_journal_staff, perdu le 22 juin
-- (raison_blocage_purge : CREATE OR REPLACE VIEW sans WITH remet les options
-- à zéro → la vue est devenue definer = journal lisible sans RLS, même anon).
-- Définition IDENTIQUE à l'actuelle (raison incluse), seule l'option change.
-- Idempotent : rejouable à froid.
CREATE OR REPLACE VIEW public.vue_journal_staff
WITH (security_invoker = true) AS
 SELECT j.id, j.acteur_id, j.acteur_role, j.cible_type, j.cible_id, j.action, j.details, j.created_at,
    nom_profil_principal(j.acteur_id) AS acteur_nom,
    CASE j.cible_type
        WHEN 'personnage'::text THEN COALESCE((SELECT p.nom FROM personnages p WHERE p.id = j.cible_id), j.details ->> 'nom'::text, j.details ->> 'libelle'::text)
        WHEN 'profil'::text THEN COALESCE((SELECT pj.nom FROM profils_joueur pj WHERE pj.id = j.cible_id), j.details ->> 'nom'::text, j.details ->> 'libelle'::text)
        WHEN 'banque'::text THEN COALESCE((SELECT pj.nom FROM profils_joueur pj WHERE pj.id = j.cible_id), j.details ->> 'nom'::text, j.details ->> 'libelle'::text)
        WHEN 'compte'::text THEN COALESCE((SELECT pr.nom_affichage FROM profiles pr WHERE pr.id = j.cible_id), j.details ->> 'nom'::text, j.details ->> 'libelle'::text)
        ELSE NULL::text
    END AS cible_nom,
    (j.details ->> 'raison'::text) AS raison
   FROM journal_audit j
  WHERE j.acteur_role <> 'proprietaire'::text;
