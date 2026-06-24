-- CIMETIÈRE — stèle « en attente » (option C + A3 gel pendant l'attente).
-- Expand-contract : la table personnage_morts_demandes est CONSERVÉE ici (front #487 la lit),
-- DROP différé à une micro-migration B après déploiement du front.

ALTER TABLE public.cimetiere ADD COLUMN IF NOT EXISTS statut text NOT NULL DEFAULT 'approuvee';
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='cimetiere_statut_check') THEN
  ALTER TABLE public.cimetiere ADD CONSTRAINT cimetiere_statut_check CHECK (statut IN ('en_attente','approuvee')); END IF; END $$;

DROP FUNCTION IF EXISTS public._figer_stele(uuid, text, uuid);
CREATE OR REPLACE FUNCTION public._figer_stele(p_personnage_id uuid, p_epitaphe text, p_cree_par uuid, p_statut text DEFAULT 'approuvee', p_tuer boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_snapshot jsonb; v_details jsonb; v_nom text; v_race text; v_classe text; v_niveau int; v_joueur_nom text; v_id uuid;
BEGIN
  SELECT to_jsonb(f.*), f.nom, f.race_nom, f.classe_nom, f.niveau, pj.nom INTO v_snapshot, v_nom, v_race, v_classe, v_niveau, v_joueur_nom
    FROM public.vue_fiche_personnage f LEFT JOIN public.profils_joueur pj ON pj.id = f.joueur_id WHERE f.id = p_personnage_id;
  IF v_snapshot IS NULL THEN RAISE EXCEPTION 'Personnage introuvable pour la stele: %', p_personnage_id; END IF;
  v_details := jsonb_build_object(
    'competences', COALESCE((SELECT jsonb_agg(jsonb_build_object('nom',nom,'categorie',categorie,'niveau',niveau) ORDER BY niveau DESC, nom) FROM (SELECT nom, categorie, max(niveau_acquis) AS niveau FROM public.vue_competences_personnage WHERE personnage_id=p_personnage_id AND nom NOT LIKE 'Acquisition de %' GROUP BY nom, categorie) c), '[]'::jsonb),
    'sorts', COALESCE((SELECT jsonb_agg(jsonb_build_object('nom',nom,'cercle',cercle,'niveau',niveau) ORDER BY cercle, niveau DESC, nom) FROM (SELECT COALESCE(nom_personnalise, sort_nom_base) AS nom, cercle, max(niveau_sort) AS niveau FROM public.vue_sorts_personnage WHERE personnage_id=p_personnage_id GROUP BY COALESCE(nom_personnalise, sort_nom_base), cercle) s), '[]'::jsonb),
    'prieres', COALESCE((SELECT jsonb_agg(jsonb_build_object('nom',nom,'domaine',domaine,'niveau',niveau) ORDER BY domaine, niveau DESC, nom) FROM (SELECT nom_personnalise AS nom, domaine, max(niveau_priere) AS niveau FROM public.vue_prieres_personnage WHERE personnage_id=p_personnage_id GROUP BY nom_personnalise, domaine) p), '[]'::jsonb),
    'assemblages', COALESCE((SELECT jsonb_agg(jsonb_build_object('nom',nom,'effet',effet) ORDER BY nom) FROM public.vue_assemblages_personnage WHERE personnage_id=p_personnage_id), '[]'::jsonb),
    'recettes', COALESCE((SELECT jsonb_agg(jsonb_build_object('nom',nom,'type',type) ORDER BY type, nom) FROM public.vue_recettes_personnage WHERE personnage_id=p_personnage_id), '[]'::jsonb));
  v_snapshot := v_snapshot || jsonb_build_object('details', v_details);
  INSERT INTO public.cimetiere (personnage_id_origine, nom, race, classe, niveau, joueur_nom, epitaphe, snapshot, cree_par, statut)
  VALUES (p_personnage_id, v_nom, v_race, v_classe, v_niveau, v_joueur_nom, NULLIF(trim(COALESCE(p_epitaphe,'')),''), v_snapshot, p_cree_par, p_statut) RETURNING id INTO v_id;
  IF p_tuer THEN UPDATE public.personnages SET est_mort = true WHERE id = p_personnage_id; END IF;
  RETURN v_id;
END; $function$;
REVOKE EXECUTE ON FUNCTION public._figer_stele(uuid,text,uuid,text,boolean) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.creer_demande_mort(p_personnage_id uuid, p_epitaphe text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_p RECORD; v_stele_id uuid;
BEGIN
  SELECT * INTO v_p FROM public.personnages WHERE id = p_personnage_id;
  IF v_p IS NULL THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Personnage introuvable'); END IF;
  IF NOT public.peut_editer_personnage(v_p.joueur_id) THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Accès refusé'); END IF;
  IF v_p.est_mort THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Ce personnage est déjà au Cimetière'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.inscriptions_evenements WHERE personnage_id = p_personnage_id AND statut = 'present') THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Ce personnage doit avoir participé à au moins un événement'); END IF;
  IF EXISTS (SELECT 1 FROM public.cimetiere WHERE personnage_id_origine = p_personnage_id AND statut = 'en_attente') THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Une demande est déjà en attente'); END IF;
  v_stele_id := public._figer_stele(p_personnage_id, p_epitaphe, auth.uid(), 'en_attente', false);
  PERFORM public.creer_notification_staff(p_message := format('⚰️ Nouvelle demande de mort pour le personnage "%s"', v_p.nom), p_type := 'demande_mort_nouvelle', p_reference_id := v_stele_id);
  PERFORM public.log_audit('personnage', p_personnage_id, 'creer_demande_mort', jsonb_build_object('stele_id', v_stele_id, 'nom', v_p.nom));
  RETURN jsonb_build_object('succes', true, 'message', 'Demande envoyée. Le staff va l''examiner.', 'stele_id', v_stele_id);
END; $function$;

DROP FUNCTION IF EXISTS public.approuver_mort_demande(uuid, text);
CREATE OR REPLACE FUNCTION public.approuver_mort_demande(p_stele_id uuid, p_epitaphe_finale text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_s RECORD; v_profil uuid;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Seuls les administrateurs peuvent approuver'); END IF;
  SELECT * INTO v_s FROM public.cimetiere WHERE id = p_stele_id;
  IF v_s IS NULL THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Stèle introuvable'); END IF;
  IF v_s.statut <> 'en_attente' THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Cette stèle n''est pas en attente'); END IF;
  UPDATE public.cimetiere SET statut='approuvee', epitaphe = COALESCE(NULLIF(trim(COALESCE(p_epitaphe_finale,'')),''), epitaphe), date_mort = now() WHERE id = p_stele_id;
  UPDATE public.personnages SET est_mort = true WHERE id = v_s.personnage_id_origine;
  v_profil := COALESCE((SELECT joueur_id FROM public.personnages WHERE id = v_s.personnage_id_origine), (v_s.snapshot->>'joueur_id')::uuid);
  IF v_profil IS NOT NULL AND EXISTS(SELECT 1 FROM public.profils_joueur WHERE id = v_profil) THEN
    PERFORM public.creer_notification(p_message := format('⚰️ Votre personnage "%s" repose désormais au Cimetière des Héros.', v_s.nom), p_type := 'mort_approuvee', p_profil_id := v_profil, p_reference_id := p_stele_id, p_statut := 'non_traite');
  END IF;
  PERFORM public.log_audit('personnage', v_s.personnage_id_origine, 'approuver_mort', jsonb_build_object('stele_id', p_stele_id, 'nom', v_s.nom));
  RETURN jsonb_build_object('succes', true, 'message', format('"%s" envoyé au Cimetière.', v_s.nom), 'stele_id', p_stele_id);
END; $function$;

DROP FUNCTION IF EXISTS public.refuser_mort_demande(uuid, text);
CREATE OR REPLACE FUNCTION public.refuser_mort_demande(p_stele_id uuid, p_raison text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_s RECORD; v_profil uuid;
BEGIN
  IF NOT est_animateur_ou_admin() THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Seuls les administrateurs peuvent refuser'); END IF;
  SELECT * INTO v_s FROM public.cimetiere WHERE id = p_stele_id;
  IF v_s IS NULL THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Stèle introuvable'); END IF;
  IF v_s.statut <> 'en_attente' THEN RETURN jsonb_build_object('succes', false, 'erreur', 'Cette stèle n''est pas en attente'); END IF;
  v_profil := COALESCE((SELECT joueur_id FROM public.personnages WHERE id = v_s.personnage_id_origine), (v_s.snapshot->>'joueur_id')::uuid);
  DELETE FROM public.cimetiere WHERE id = p_stele_id;
  IF v_profil IS NOT NULL AND EXISTS(SELECT 1 FROM public.profils_joueur WHERE id = v_profil) THEN
    PERFORM public.creer_notification(p_message := format('Votre demande de mort pour "%s" a été refusée.%s', v_s.nom, COALESCE(' Raison : '||NULLIF(trim(COALESCE(p_raison,'')),''), '')), p_type := 'mort_refusee', p_profil_id := v_profil, p_reference_id := v_s.personnage_id_origine, p_statut := 'non_traite');
  END IF;
  PERFORM public.log_audit('personnage', v_s.personnage_id_origine, 'refuser_mort', jsonb_build_object('nom', v_s.nom, 'raison', p_raison));
  RETURN jsonb_build_object('succes', true, 'message', 'Demande refusée.');
END; $function$;

CREATE OR REPLACE FUNCTION public.etat_edition_personnage(p_personnage_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_est_finalise boolean; v_est_mort boolean; v_a_ete_present boolean; v_ev_id uuid; v_ev_titre text; v_ev_date timestamptz; v_dans_fenetre boolean := false; v_etat text; v_peut_tout_editer boolean; v_peut_ajouter boolean; v_rattrapage_editable boolean; v_raison text; v_evenement_bloquant uuid := NULL; v_epitaphe_attente text := NULL; v_a_demande boolean := false;
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
    SELECT e.id, e.titre, e.date_evenement INTO v_ev_id, v_ev_titre, v_ev_date FROM public.inscriptions_evenements i JOIN public.evenements e ON e.id = i.evenement_id WHERE i.personnage_id = p_personnage_id AND i.statut IN ('en_attente','present') AND e.est_termine = false ORDER BY e.date_evenement LIMIT 1;
    v_dans_fenetre := (v_ev_date IS NOT NULL AND (v_ev_date - interval '24 hours') <= now());
    SELECT EXISTS (SELECT 1 FROM public.inscriptions_evenements WHERE personnage_id = p_personnage_id AND statut = 'present') INTO v_a_ete_present;
    IF v_dans_fenetre THEN v_etat := 'gele'; v_peut_tout_editer := false; v_peut_ajouter := false; v_rattrapage_editable := false; v_raison := 'Événement imminent (moins de 24 h) — fiche gelée jusqu''à la confirmation des présences.'; v_evenement_bloquant := v_ev_id;
    ELSIF v_a_ete_present THEN v_etat := 'campagne'; v_peut_tout_editer := false; v_peut_ajouter := true; v_rattrapage_editable := false; v_raison := 'En campagne — ajouts et améliorations uniquement (nom/race/traits figés).';
    ELSE v_etat := 'remodelage_libre'; v_peut_tout_editer := true; v_peut_ajouter := true; v_rattrapage_editable := (v_ev_id IS NULL);
      IF v_ev_id IS NOT NULL THEN v_raison := 'Remodelage libre — modifiable jusqu''à 24 h avant l''événement inscrit (compteurs d''expérience figés tant qu''inscrit).'; ELSE v_raison := 'Remodelage libre — tout est modifiable.'; END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object('etat', v_etat, 'peut_tout_editer', v_peut_tout_editer, 'peut_ajouter', v_peut_ajouter, 'rattrapage_editable', v_rattrapage_editable, 'raison', v_raison, 'evenement_bloquant_id', v_evenement_bloquant, 'evenement_inscrit_id', v_ev_id, 'evenement_inscrit_titre', v_ev_titre, 'evenement_inscrit_date', v_ev_date, 'dans_fenetre_gel', v_dans_fenetre, 'demande_mort_epitaphe', v_epitaphe_attente);
END; $function$;

CREATE OR REPLACE VIEW public.vue_cimetiere AS
SELECT id, personnage_id_origine, nom, race, classe, niveau, date_mort, epitaphe, snapshot, created_at, joueur_nom FROM public.cimetiere WHERE statut = 'approuvee' ORDER BY date_mort DESC;

DROP VIEW IF EXISTS public.vue_demandes_morts_attente;
CREATE VIEW public.vue_demandes_morts_attente AS
SELECT c.id, c.personnage_id_origine AS personnage_id, c.epitaphe, c.statut, c.created_at, c.nom AS personnage_nom, c.race AS race_nom, c.classe AS classe_nom, c.niveau, (c.snapshot->>'joueur_id')::uuid AS joueur_id, c.joueur_nom FROM public.cimetiere c WHERE c.statut = 'en_attente' ORDER BY c.created_at;

DROP POLICY IF EXISTS cimetiere_select_public ON public.cimetiere;
CREATE POLICY cimetiere_select_public ON public.cimetiere FOR SELECT USING (statut = 'approuvee' OR est_animateur_ou_admin());
