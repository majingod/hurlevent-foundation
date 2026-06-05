-- Phase 2 — M1 Fondation : ledger banque XP joueur + vue solde + fonction etat_edition_personnage.
-- Pur data / additif : aucun flux existant touché. Append-only par construction (RLS SELECT-only).

CREATE TABLE IF NOT EXISTS public.banque_xp_mouvements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  joueur_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type_mouvement      text NOT NULL,
  montant             integer NOT NULL,
  evenement_id        uuid REFERENCES public.evenements(id) ON DELETE SET NULL,
  personnage_cible_id uuid REFERENCES public.personnages(id) ON DELETE SET NULL,
  acteur_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  description         text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_banque_montant_non_nul CHECK (montant <> 0),
  CONSTRAINT chk_banque_type_valide CHECK (
    type_mouvement IN ('gain_mini_gn','transfert_vers_personnage','ajustement_admin')
  ),
  CONSTRAINT chk_banque_type_alignement CHECK (
       (type_mouvement = 'gain_mini_gn'              AND montant > 0 AND personnage_cible_id IS NULL)
    OR (type_mouvement = 'transfert_vers_personnage' AND montant < 0 AND evenement_id IS NULL)
    OR (type_mouvement = 'ajustement_admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_banque_joueur ON public.banque_xp_mouvements(joueur_id);

ALTER TABLE public.banque_xp_mouvements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS banque_xp_select_proprietaire_ou_admin ON public.banque_xp_mouvements;
CREATE POLICY banque_xp_select_proprietaire_ou_admin
  ON public.banque_xp_mouvements FOR SELECT
  USING (auth.uid() IS NOT NULL AND (joueur_id = auth.uid() OR public.est_animateur_ou_admin()));

GRANT SELECT ON public.banque_xp_mouvements TO anon, authenticated;

CREATE OR REPLACE VIEW public.vue_banque_joueur AS
SELECT
  p.id AS joueur_id,
  COALESCE(SUM(m.montant), 0)::int                               AS solde,
  COALESCE(SUM(m.montant) FILTER (WHERE m.montant > 0), 0)::int  AS total_gagne,
  COALESCE(SUM(-m.montant) FILTER (WHERE m.montant < 0), 0)::int AS total_transfere
FROM public.profiles p
LEFT JOIN public.banque_xp_mouvements m ON m.joueur_id = p.id
WHERE auth.uid() IS NOT NULL AND (p.id = auth.uid() OR public.est_animateur_ou_admin())
GROUP BY p.id;

GRANT SELECT ON public.vue_banque_joueur TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.etat_edition_personnage(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_est_finalise        boolean;
  v_est_mort            boolean;
  v_evenement_bloquant  uuid;
  v_a_ete_present       boolean;
  v_etat                text;
  v_peut_tout_editer    boolean;
  v_peut_ajouter        boolean;
  v_raison              text;
BEGIN
  SELECT est_finalise, est_mort INTO v_est_finalise, v_est_mort
  FROM public.personnages WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'etat', NULL, 'peut_tout_editer', false, 'peut_ajouter', false,
      'raison', 'Personnage introuvable.', 'evenement_bloquant_id', NULL);
  END IF;

  IF v_est_mort THEN
    v_etat := 'mort'; v_peut_tout_editer := false; v_peut_ajouter := false;
    v_raison := 'Personnage mort — lecture seule.';
  ELSIF NOT v_est_finalise THEN
    v_etat := 'brouillon'; v_peut_tout_editer := true; v_peut_ajouter := true;
    v_raison := 'En création (wizard).';
  ELSE
    SELECT i.evenement_id INTO v_evenement_bloquant
    FROM public.inscriptions_evenements i
    JOIN public.evenements e ON e.id = i.evenement_id
    WHERE i.personnage_id = p_personnage_id
      AND i.statut IN ('en_attente','present')
      AND e.est_termine = false
    ORDER BY e.date_evenement
    LIMIT 1;

    SELECT EXISTS (
      SELECT 1 FROM public.inscriptions_evenements
      WHERE personnage_id = p_personnage_id AND statut = 'present'
    ) INTO v_a_ete_present;

    IF v_evenement_bloquant IS NOT NULL THEN
      v_etat := 'gele'; v_peut_tout_editer := false; v_peut_ajouter := false;
      v_raison := 'Inscrit à un événement à venir — fiche gelée jusqu''à sa résolution.';
    ELSIF v_a_ete_present THEN
      v_etat := 'campagne'; v_peut_tout_editer := false; v_peut_ajouter := true;
      v_raison := 'En campagne — ajouts et améliorations uniquement (nom/race/traits figés).';
    ELSE
      v_etat := 'remodelage_libre'; v_peut_tout_editer := true; v_peut_ajouter := true;
      v_raison := 'Remodelage libre — tout est modifiable.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'etat', v_etat,
    'peut_tout_editer', v_peut_tout_editer,
    'peut_ajouter', v_peut_ajouter,
    'raison', v_raison,
    'evenement_bloquant_id', v_evenement_bloquant);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.etat_edition_personnage(uuid) TO anon, authenticated;
