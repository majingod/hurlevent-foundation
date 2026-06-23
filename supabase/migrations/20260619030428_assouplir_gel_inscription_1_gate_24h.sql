CREATE OR REPLACE FUNCTION public.etat_edition_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_est_finalise        boolean;
  v_est_mort            boolean;
  v_a_ete_present       boolean;
  v_ev_id               uuid;
  v_ev_titre            text;
  v_ev_date             timestamptz;
  v_dans_fenetre        boolean := false;
  v_etat                text;
  v_peut_tout_editer    boolean;
  v_peut_ajouter        boolean;
  v_rattrapage_editable boolean;
  v_raison              text;
  v_evenement_bloquant  uuid := NULL;
BEGIN
  SELECT est_finalise, est_mort INTO v_est_finalise, v_est_mort
  FROM public.personnages WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'etat', NULL, 'peut_tout_editer', false, 'peut_ajouter', false,
      'rattrapage_editable', false, 'raison', 'Personnage introuvable.',
      'evenement_bloquant_id', NULL, 'evenement_inscrit_id', NULL,
      'evenement_inscrit_titre', NULL, 'evenement_inscrit_date', NULL,
      'dans_fenetre_gel', false);
  END IF;

  IF v_est_mort THEN
    v_etat := 'mort'; v_peut_tout_editer := false; v_peut_ajouter := false;
    v_rattrapage_editable := false;
    v_raison := 'Personnage mort — lecture seule.';
  ELSIF NOT v_est_finalise THEN
    v_etat := 'brouillon'; v_peut_tout_editer := true; v_peut_ajouter := true;
    v_rattrapage_editable := true;
    v_raison := 'En création (wizard).';
  ELSE
    SELECT e.id, e.titre, e.date_evenement
      INTO v_ev_id, v_ev_titre, v_ev_date
    FROM public.inscriptions_evenements i
    JOIN public.evenements e ON e.id = i.evenement_id
    WHERE i.personnage_id = p_personnage_id
      AND i.statut IN ('en_attente','present')
      AND e.est_termine = false
    ORDER BY e.date_evenement
    LIMIT 1;

    v_dans_fenetre := (v_ev_date IS NOT NULL
                       AND (v_ev_date - interval '24 hours') <= now());

    SELECT EXISTS (
      SELECT 1 FROM public.inscriptions_evenements
      WHERE personnage_id = p_personnage_id AND statut = 'present'
    ) INTO v_a_ete_present;

    IF v_dans_fenetre THEN
      v_etat := 'gele'; v_peut_tout_editer := false; v_peut_ajouter := false;
      v_rattrapage_editable := false;
      v_raison := 'Événement imminent (moins de 24 h) — fiche gelée jusqu''à la confirmation des présences.';
      v_evenement_bloquant := v_ev_id;
    ELSIF v_a_ete_present THEN
      v_etat := 'campagne'; v_peut_tout_editer := false; v_peut_ajouter := true;
      v_rattrapage_editable := false;
      v_raison := 'En campagne — ajouts et améliorations uniquement (nom/race/traits figés).';
    ELSE
      v_etat := 'remodelage_libre'; v_peut_tout_editer := true; v_peut_ajouter := true;
      v_rattrapage_editable := (v_ev_id IS NULL);
      IF v_ev_id IS NOT NULL THEN
        v_raison := 'Remodelage libre — modifiable jusqu''à 24 h avant l''événement inscrit (compteurs d''expérience figés tant qu''inscrit).';
      ELSE
        v_raison := 'Remodelage libre — tout est modifiable.';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'etat', v_etat,
    'peut_tout_editer', v_peut_tout_editer,
    'peut_ajouter', v_peut_ajouter,
    'rattrapage_editable', v_rattrapage_editable,
    'raison', v_raison,
    'evenement_bloquant_id', v_evenement_bloquant,
    'evenement_inscrit_id', v_ev_id,
    'evenement_inscrit_titre', v_ev_titre,
    'evenement_inscrit_date', v_ev_date,
    'dans_fenetre_gel', v_dans_fenetre);
END;
$function$;
