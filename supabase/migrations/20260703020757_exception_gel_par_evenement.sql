-- Reglage « heures de gel » PAR EVENEMENT (NULL = 24h par defaut).
-- Pilote A LA FOIS le gel d'edition de fiche (etat_edition_personnage)
-- ET le blocage de desinscription (trg_bloquer_desinscription_fenetre_gel).
ALTER TABLE public.evenements ADD COLUMN IF NOT EXISTS gel_heures_avant integer;

COMMENT ON COLUMN public.evenements.gel_heures_avant IS
  'Nombre d''heures avant date_evenement ou la fiche se gele et la desinscription se bloque. NULL = 24h (defaut global).';

CREATE OR REPLACE FUNCTION public.etat_edition_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE v_est_finalise boolean; v_est_mort boolean; v_a_ete_present boolean; v_ev_id uuid; v_ev_titre text; v_ev_date timestamptz; v_gel_heures integer := 24; v_dans_fenetre boolean := false; v_etat text; v_peut_tout_editer boolean; v_peut_ajouter boolean; v_rattrapage_editable boolean; v_raison text; v_evenement_bloquant uuid := NULL; v_epitaphe_attente text := NULL; v_a_demande boolean := false;
BEGIN
  SELECT est_finalise, est_mort INTO v_est_finalise, v_est_mort FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('etat', NULL, 'peut_tout_editer', false, 'peut_ajouter', false, 'rattrapage_editable', false, 'raison', 'Personnage introuvable.', 'evenement_bloquant_id', NULL, 'evenement_inscrit_id', NULL, 'evenement_inscrit_titre', NULL, 'evenement_inscrit_date', NULL, 'dans_fenetre_gel', false, 'demande_mort_epitaphe', NULL);
  END IF;
  SELECT epitaphe, true INTO v_epitaphe_attente, v_a_demande FROM public.cimetiere WHERE personnage_id_origine = p_personnage_id AND statut = 'en_attente' LIMIT 1;
  IF v_est_mort THEN
    v_etat := 'mort'; v_peut_tout_editer := false; v_peut_ajouter := false; v_rattrapage_editable := false; v_raison := 'Personnage mort — lecture seule.';
  ELSIF COALESCE(v_a_demande,false) THEN
    v_etat := 'mort_en_attente'; v_peut_tout_editer := false; v_peut_ajouter := false; v_rattrapage_editable := false; v_raison := 'Demande de mort en attente — fiche verrouillée jusqu''à la décision du staff.';
  ELSIF NOT v_est_finalise THEN
    v_etat := 'brouillon'; v_peut_tout_editer := true; v_peut_ajouter := true; v_rattrapage_editable := true; v_raison := 'En création (wizard).';
  ELSE
    SELECT e.id, e.titre, e.date_evenement, COALESCE(e.gel_heures_avant, 24) INTO v_ev_id, v_ev_titre, v_ev_date, v_gel_heures FROM public.inscriptions_evenements i JOIN public.evenements e ON e.id = i.evenement_id WHERE i.personnage_id = p_personnage_id AND i.statut IN ('en_attente','present') AND e.est_termine = false ORDER BY e.date_evenement LIMIT 1;
    v_dans_fenetre := (v_ev_date IS NOT NULL AND (v_ev_date - make_interval(hours => COALESCE(v_gel_heures,24))) <= now());
    SELECT EXISTS (SELECT 1 FROM public.inscriptions_evenements WHERE personnage_id = p_personnage_id AND statut = 'present') INTO v_a_ete_present;
    IF v_dans_fenetre THEN v_etat := 'gele'; v_peut_tout_editer := false; v_peut_ajouter := false; v_rattrapage_editable := false; v_raison := 'Événement imminent (moins de ' || COALESCE(v_gel_heures,24)::text || ' h) — fiche gelée jusqu''à la confirmation des présences.'; v_evenement_bloquant := v_ev_id;
    ELSIF v_a_ete_present THEN v_etat := 'campagne'; v_peut_tout_editer := false; v_peut_ajouter := true; v_rattrapage_editable := false; v_raison := 'En campagne — ajouts et améliorations uniquement (nom/race/traits figés).';
    ELSE v_etat := 'remodelage_libre'; v_peut_tout_editer := true; v_peut_ajouter := true; v_rattrapage_editable := (v_ev_id IS NULL);
      IF v_ev_id IS NOT NULL THEN v_raison := 'Remodelage libre — modifiable jusqu''à ' || COALESCE(v_gel_heures,24)::text || ' h avant l''événement inscrit (compteurs d''expérience figés tant qu''inscrit).'; ELSE v_raison := 'Remodelage libre — tout est modifiable.'; END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('etat', v_etat, 'peut_tout_editer', v_peut_tout_editer, 'peut_ajouter', v_peut_ajouter, 'rattrapage_editable', v_rattrapage_editable, 'raison', v_raison, 'evenement_bloquant_id', v_evenement_bloquant, 'evenement_inscrit_id', v_ev_id, 'evenement_inscrit_titre', v_ev_titre, 'evenement_inscrit_date', v_ev_date, 'dans_fenetre_gel', v_dans_fenetre, 'demande_mort_epitaphe', v_epitaphe_attente);
END; $fn$;

CREATE OR REPLACE FUNCTION public.trg_bloquer_desinscription_fenetre_gel()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE v_date timestamptz; v_termine boolean; v_gel_heures integer := 24;
BEGIN
  IF auth.uid() IS NULL OR public.est_admin() THEN
    RETURN OLD;
  END IF;
  SELECT date_evenement, est_termine, COALESCE(gel_heures_avant,24) INTO v_date, v_termine, v_gel_heures
  FROM public.evenements WHERE id = OLD.evenement_id;
  IF v_termine = false AND v_date IS NOT NULL
     AND (v_date - make_interval(hours => COALESCE(v_gel_heures,24))) <= now()
     AND OLD.statut IN ('en_attente','present') THEN
    RAISE EXCEPTION 'Desinscription impossible : l''evenement commence dans moins de % h. Le personnage reste verrouille jusqu''a la confirmation des presences.', COALESCE(v_gel_heures,24)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$fn$;
