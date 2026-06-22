-- PR4 : enrichit vue_journal_staff avec acteur_nom + cible_nom (résolus).
-- Additif, security_invoker préservé, colonnes de tête inchangées.
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
    ( SELECT p.nom FROM public.personnages p
       WHERE p.id = j.cible_id AND j.cible_type = 'personnage' ) AS cible_nom
  FROM public.journal_audit j
  WHERE j.acteur_role <> 'proprietaire';
