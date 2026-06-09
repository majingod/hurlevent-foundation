-- JOURNAL-AUDIT PR3 : viewer joueur
-- Helper de résolution du nom + vue scopée par RLS (Option 1).
-- Additif, security_invoker : aucun changement de comportement.

-- 1) Helper : nom du profil principal d'un compte acteur.
CREATE OR REPLACE FUNCTION public.nom_profil_principal(p_acteur_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nom text;
BEGIN
  IF p_acteur_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT pj.nom
    INTO v_nom
    FROM public.profils_joueur pj
   WHERE pj.compte_id = p_acteur_id
     AND pj.est_principal = true
   LIMIT 1;

  RETURN v_nom;
END;
$$;

-- 2) Vue : toutes les lignes d'audit ciblant un personnage.
DROP VIEW IF EXISTS public.vue_journal_mon_personnage;

CREATE VIEW public.vue_journal_mon_personnage
WITH (security_invoker = true) AS
SELECT
  ja.id,
  ja.acteur_id,
  ja.acteur_role,
  public.nom_profil_principal(ja.acteur_id) AS acteur_nom,
  ja.cible_type,
  ja.cible_id,
  ja.action,
  ja.details,
  ja.created_at
FROM public.journal_audit ja
WHERE ja.cible_type = 'personnage';
