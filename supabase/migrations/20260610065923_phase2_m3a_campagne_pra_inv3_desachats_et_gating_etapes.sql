-- M3a-campagne PR-A (2/2) — INV-3 désachats + gating étapes 1-4
-- A) 6 RPC desacheter_* : en état 'campagne', le désachat est permis SI tout le set
--    supprimé (cascade incluse) est hors de la dernière photo (INV-3) ;
--    sinon erreur 'acquis_intouchable' (INV-1). Photo absente => tout réputé acquis.
-- B) sauvegarder_etape_1..4 : remplacement de personnage_est_modifiable par
--    gate_edition_personnage('complet') (juge moderne, ferme aussi le trou 'gele').
--    Étape 1 : en campagne, permis seulement si les champs figés (INV-4) sont
--    inchangés — historique/âme restent libres (INV-5).

-- ============ A1. desacheter_sort ============
CREATE OR REPLACE FUNCTION public.desacheter_sort(p_personnage_sort_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_ps personnage_sorts%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_ps FROM personnage_sorts WHERE id = p_personnage_sort_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce sort n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_ps.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_ps.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_ps.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  -- INV-1/INV-3 : en campagne, seul un sort hors de la dernière photo est annulable.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_ps.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'sorts','[]'::jsonb)) e
      WHERE (e.value->>'id')::uuid = v_ps.sort_id
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Ce sort fait partie des acquis du personnage (dernière présence confirmée) — il ne peut pas être annulé en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  DELETE FROM personnage_sorts WHERE id = p_personnage_sort_id;

  IF v_ps.xp_depense > 0 THEN
    UPDATE personnages
    SET xp_depense = xp_depense - v_ps.xp_depense,
        date_modification = now(),
        updated_at = now()
    WHERE id = v_ps.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
    VALUES (v_ps.personnage_id, 'remboursement', v_ps.xp_depense,
      'Remboursement sort (' || v_ps.xp_depense || ' XP)', v_ps.sort_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_ps.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_sort', jsonb_build_object('personnage_sort_id', p_personnage_sort_id, 'nom', (SELECT nom FROM sorts WHERE id = v_ps.sort_id), 'niveau', v_ps.niveau_sort, 'xp_rembourse', v_ps.xp_depense));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_sort_id', p_personnage_sort_id,
      'sort_id', v_ps.sort_id,
      'xp_rembourse', v_ps.xp_depense,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

-- ============ A2. desacheter_priere ============
CREATE OR REPLACE FUNCTION public.desacheter_priere(p_personnage_priere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pp personnage_prieres%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pp FROM personnage_prieres WHERE id = p_personnage_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette prière n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_pp.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pp.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pp.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'prieres','[]'::jsonb)) e
      WHERE (e.value->>'id')::uuid = v_pp.priere_id
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Cette prière fait partie des acquis du personnage (dernière présence confirmée) — elle ne peut pas être annulée en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  DELETE FROM personnage_prieres WHERE id = p_personnage_priere_id;

  IF v_pp.xp_depense > 0 THEN
    UPDATE personnages
    SET xp_depense = xp_depense - v_pp.xp_depense,
        date_modification = now(),
        updated_at = now()
    WHERE id = v_pp.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
    VALUES (v_pp.personnage_id, 'remboursement', v_pp.xp_depense,
      'Remboursement prière (' || v_pp.xp_depense || ' XP)', v_pp.priere_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pp.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_priere', jsonb_build_object('personnage_priere_id', p_personnage_priere_id, 'nom', (SELECT nom FROM prieres WHERE id = v_pp.priere_id), 'niveau', v_pp.niveau_priere, 'xp_rembourse', v_pp.xp_depense));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'priere_id', v_pp.priere_id,
      'xp_rembourse', v_pp.xp_depense,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

-- ============ A3. desacheter_recette ============
CREATE OR REPLACE FUNCTION public.desacheter_recette(p_personnage_recette_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid              uuid := auth.uid();
  v_perso            personnages%ROWTYPE;
  v_pr               personnage_recettes%ROWTYPE;
  v_xp_total_apres   integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pr FROM personnage_recettes WHERE id = p_personnage_recette_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette recette n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pr.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_pr.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pr.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pr.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'recettes','[]'::jsonb)) e
      WHERE (e.value->>'id')::uuid = v_pr.recette_id
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Cette recette fait partie des acquis du personnage (dernière présence confirmée) — elle ne peut pas être annulée en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  DELETE FROM personnage_recettes WHERE id = p_personnage_recette_id;

  -- Compense la ligne supprimée (invisible au réconciliateur après DELETE)
  IF COALESCE(v_pr.xp_depense, 0) > 0 THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
    VALUES (v_pr.personnage_id, 'remboursement', v_pr.xp_depense,
      'Remboursement recette d''alchimie (' || v_pr.xp_depense || ' XP)', v_pr.recette_id, v_uid);
  END IF;

  -- Auto-soin : promeut une éventuelle ligne payante du même palier
  PERFORM public.reconcilier_recettes(v_pr.personnage_id);

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
    FROM personnages WHERE id = v_pr.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_recette', jsonb_build_object('personnage_recette_id', p_personnage_recette_id, 'nom', (SELECT nom FROM recettes_alchimie WHERE id = v_pr.recette_id), 'xp_rembourse', CASE WHEN v_pr.est_gratuit THEN 0 ELSE v_pr.xp_depense END));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_recette_id', p_personnage_recette_id,
      'recette_id', v_pr.recette_id,
      'etait_gratuit', v_pr.est_gratuit,
      'xp_rembourse', CASE WHEN v_pr.est_gratuit THEN 0 ELSE v_pr.xp_depense END,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

-- ============ A4. desacheter_assemblage ============
CREATE OR REPLACE FUNCTION public.desacheter_assemblage(p_personnage_assemblage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid              uuid := auth.uid();
  v_perso            personnages%ROWTYPE;
  v_pa               personnage_assemblages%ROWTYPE;
  v_xp_total_apres   integer;
  v_xp_depense_apres integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pa FROM personnage_assemblages WHERE id = p_personnage_assemblage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cet assemblage n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pa.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_pa.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pa.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pa.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'assemblages','[]'::jsonb)) e
      WHERE (e.value->>'id')::uuid = v_pa.assemblage_id
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Cet assemblage fait partie des acquis du personnage (dernière présence confirmée) — il ne peut pas être annulé en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  DELETE FROM personnage_assemblages WHERE id = p_personnage_assemblage_id;

  IF COALESCE(v_pa.xp_depense, 0) > 0 THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
    VALUES (v_pa.personnage_id, 'remboursement', v_pa.xp_depense,
      'Remboursement assemblage de runes (' || v_pa.xp_depense || ' XP)', v_pa.assemblage_id, v_uid);
  END IF;

  PERFORM public.reconcilier_assemblages(v_pa.personnage_id);

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
    FROM personnages WHERE id = v_pa.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_assemblage', jsonb_build_object('personnage_assemblage_id', p_personnage_assemblage_id, 'nom', (SELECT nom FROM assemblages_runes WHERE id = v_pa.assemblage_id), 'xp_rembourse', CASE WHEN v_pa.est_gratuit THEN 0 ELSE v_pa.xp_depense END));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_assemblage_id', p_personnage_assemblage_id,
      'assemblage_id', v_pa.assemblage_id,
      'etait_gratuit', v_pa.est_gratuit,
      'xp_rembourse', CASE WHEN v_pa.est_gratuit THEN 0 ELSE v_pa.xp_depense END,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

-- ============ A5. desacheter_piege ============
CREATE OR REPLACE FUNCTION public.desacheter_piege(p_personnage_piege_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid(); v_pp personnage_pieges%ROWTYPE; v_perso personnages%ROWTYPE;
  v_ligne RECORD; v_lignes_supprimees jsonb := '[]'::jsonb;
  v_xp_total_rembourse integer := 0; v_nb_lignes integer := 0; v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_pp FROM personnage_pieges WHERE id=p_personnage_piege_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce piège n''existe pas dans le personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id=v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  v_blocage := public.gate_edition_personnage(v_pp.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pp.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;
  -- INV-1/INV-3 : refuser si la suppression (palier ciblé et supérieurs) toucherait un palier de la photo.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pp.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'pieges','[]'::jsonb)) e
      WHERE e.value->>'nom' = v_pp.piege_nom
        AND COALESCE((e.value->>'niveau')::int, 0) >= v_pp.niveau_acquis
    ) THEN
      RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Ce palier de piège fait partie des acquis du personnage (dernière présence confirmée) — il ne peut pas être annulé en campagne.')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
    END IF;
  END IF;
  FOR v_ligne IN SELECT id,niveau_acquis,xp_depense FROM personnage_pieges
    WHERE personnage_id=v_pp.personnage_id AND piege_nom=v_pp.piege_nom AND niveau_acquis>=v_pp.niveau_acquis ORDER BY niveau_acquis DESC
  LOOP
    v_lignes_supprimees := v_lignes_supprimees || jsonb_build_object('personnage_piege_id',v_ligne.id,'niveau_acquis',v_ligne.niveau_acquis,'xp_rembourse',v_ligne.xp_depense);
    v_xp_total_rembourse := v_xp_total_rembourse + v_ligne.xp_depense; v_nb_lignes := v_nb_lignes + 1;
  END LOOP;
  DELETE FROM personnage_pieges WHERE personnage_id=v_pp.personnage_id AND piege_nom=v_pp.piege_nom AND niveau_acquis>=v_pp.niveau_acquis;
  IF v_xp_total_rembourse>0 THEN
    INSERT INTO historique_xp (personnage_id,type_mouvement,montant,description,piege_id,acteur_id)
    VALUES (v_pp.personnage_id,'remboursement',v_xp_total_rembourse,'Annulation piège « '||v_pp.piege_nom||' » ('||v_nb_lignes::text||' palier(s))',v_pp.piege_id,v_uid);
  END IF;
  SELECT xp_total,xp_depense INTO v_xp_total,v_xp_depense FROM personnages WHERE id=v_pp.personnage_id;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_piege', jsonb_build_object('personnage_piege_id', p_personnage_piege_id, 'nom', v_pp.piege_nom, 'niveau', v_pp.niveau_acquis, 'xp_rembourse', v_xp_total_rembourse));
  END IF;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',jsonb_build_object('piege_nom',v_pp.piege_nom,'lignes_supprimees',v_lignes_supprimees,'nb_paliers_supprimes',v_nb_lignes,'xp_rembourse',v_xp_total_rembourse,'xp_total',v_xp_total,'xp_depense',v_xp_depense,'xp_restant',v_xp_total-v_xp_depense));
END; $function$;

-- ============ A6. desacheter_competence ============
CREATE OR REPLACE FUNCTION public.desacheter_competence(p_personnage_competence_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE; v_pc personnage_competences%ROWTYPE; v_comp competences%ROWTYPE;
  v_removal_ids uuid[] := ARRAY[]::uuid[];
  v_prereq jsonb; v_dep RECORD; v_max int; v_changed boolean;
  v_purge_sorts boolean := false; v_purge_prieres boolean := false;
  v_items_comp jsonb := '[]'::jsonb; v_items_sorts jsonb := '[]'::jsonb; v_items_prieres jsonb := '[]'::jsonb; v_items_detail jsonb;
  v_xp_comp int := 0; v_xp_sorts int := 0; v_xp_prieres int := 0; v_xp_rembourse int := 0;
  v_nb_comp int := 0; v_nb_comp_distinct int := 0; v_nb_sorts int := 0; v_nb_prieres int := 0; v_cascade boolean;
  v_xp_total_apres int; v_xp_depense_apres int; v_donnees jsonb;
  v_item RECORD; v_log boolean := false;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_pc FROM personnage_competences WHERE id = p_personnage_competence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cet achat de compétence n''existe pas')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id = v_pc.personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  v_blocage := public.gate_edition_personnage(v_pc.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pc.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;
  SELECT * INTO v_comp FROM competences WHERE id = v_pc.competence_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','competence_introuvable','message','Compétence introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF v_pc.xp_depense = 0 AND NOT v_comp.desachat_force THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','competence_gratuite','message','Une compétence acquise gratuitement (de classe) ne peut pas être désachetée')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;

  BEGIN
    IF v_comp.type_achat IN ('simple','unique_avec_choix','multiple_avec_choix_par_niveau') THEN
      v_removal_ids := ARRAY(SELECT id FROM personnage_competences WHERE personnage_id=v_pc.personnage_id AND competence_id=v_pc.competence_id AND niveau_acquis >= v_pc.niveau_acquis AND (v_comp.type_achat <> 'multiple_avec_choix_par_niveau' OR v_pc.choix_achat IS NULL OR choix_achat = v_pc.choix_achat));
      DELETE FROM personnage_competences WHERE personnage_id=v_pc.personnage_id AND competence_id=v_pc.competence_id AND niveau_acquis >= v_pc.niveau_acquis AND (v_comp.type_achat <> 'multiple_avec_choix_par_niveau' OR v_pc.choix_achat IS NULL OR choix_achat = v_pc.choix_achat);
    ELSE
      v_removal_ids := ARRAY[v_pc.id];
      DELETE FROM personnage_competences WHERE id = v_pc.id;
    END IF;
    v_changed := true;
    WHILE v_changed LOOP
      v_changed := false;
      v_prereq := verifier_prerequis_competences(v_pc.personnage_id);
      FOR v_dep IN SELECT pc.competence_id AS cid, max(pc.niveau_acquis) AS niv FROM personnage_competences pc WHERE pc.personnage_id = v_pc.personnage_id GROUP BY pc.competence_id LOOP
        IF v_prereq ? v_dep.cid::text THEN
          v_max := COALESCE((v_prereq -> v_dep.cid::text ->> 'niveau_max_achetable')::int, 3);
          IF v_dep.niv > v_max THEN
            v_removal_ids := v_removal_ids || ARRAY(SELECT id FROM personnage_competences WHERE personnage_id=v_pc.personnage_id AND competence_id=v_dep.cid AND niveau_acquis > v_max);
            DELETE FROM personnage_competences WHERE personnage_id=v_pc.personnage_id AND competence_id=v_dep.cid AND niveau_acquis > v_max;
            v_changed := true;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
    RAISE EXCEPTION 'CASCADE_SIMULE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'CASCADE_SIMULE%' THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','erreur_cascade','message',SQLERRM)),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  END;

  SELECT COALESCE(bool_or(c.nom='Acquisition de Sort'),false), COALESCE(bool_or(c.nom='Acquisition de Prière'),false) INTO v_purge_sorts, v_purge_prieres FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id WHERE pc.id = ANY(v_removal_ids);

  -- INV-1/INV-3 (campagne) : refuser si le set supprimé (cascade incluse) toucherait la photo.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pc.personnage_id);
    IF v_photo IS NULL
       OR EXISTS (
         SELECT 1 FROM personnage_competences pc2
         WHERE pc2.id = ANY(v_removal_ids)
           AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'competences','[]'::jsonb)) e
             WHERE (e.value->>'id')::uuid = pc2.competence_id
               AND (e.value->>'choix') IS NOT DISTINCT FROM pc2.choix_achat
               AND COALESCE((e.value->>'niveau')::int, 0) >= pc2.niveau_acquis))
       OR (v_purge_sorts AND jsonb_array_length(COALESCE(v_photo->'sorts','[]'::jsonb)) > 0)
       OR (v_purge_prieres AND jsonb_array_length(COALESCE(v_photo->'prieres','[]'::jsonb)) > 0)
    THEN
      RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Ce désachat toucherait des acquis du personnage (dernière présence confirmée), directement ou par cascade — impossible en campagne.')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('type','competence','type_label','Compétence','nom',t.nom,'quantite',t.cnt,'xp_unitaire',t.xp_unit,'xp_total',t.xp_total,'niveaux',t.niveaux) ORDER BY t.nom),'[]'::jsonb), COALESCE(SUM(t.xp_total),0)::int, COALESCE(SUM(t.cnt),0)::int, COUNT(*)::int
    INTO v_items_comp, v_xp_comp, v_nb_comp, v_nb_comp_distinct
    FROM (SELECT c.nom, count(*)::int cnt, SUM(pc.xp_depense)::int xp_total, MIN(pc.xp_depense)::int xp_unit, jsonb_agg(pc.niveau_acquis ORDER BY pc.niveau_acquis) AS niveaux FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id WHERE pc.id = ANY(v_removal_ids) GROUP BY c.nom) t;

  IF v_purge_sorts THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('type','sort','type_label','Sort','nom',COALESCE(ps.nom_personnalise,s.nom),'quantite',1,'xp_unitaire',ps.xp_depense,'xp_total',ps.xp_depense) ORDER BY COALESCE(ps.nom_personnalise,s.nom)),'[]'::jsonb), COUNT(*)::int, COALESCE(SUM(ps.xp_depense),0)::int INTO v_items_sorts, v_nb_sorts, v_xp_sorts FROM personnage_sorts ps JOIN sorts s ON s.id=ps.sort_id WHERE ps.personnage_id=v_pc.personnage_id;
  END IF;
  IF v_purge_prieres THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('type','priere','type_label','Prière','nom',COALESCE(pp.nom_personnalise,pr.nom),'quantite',1,'xp_unitaire',pp.xp_depense,'xp_total',pp.xp_depense) ORDER BY COALESCE(pp.nom_personnalise,pr.nom)),'[]'::jsonb), COUNT(*)::int, COALESCE(SUM(pp.xp_depense),0)::int INTO v_items_prieres, v_nb_prieres, v_xp_prieres FROM personnage_prieres pp JOIN prieres pr ON pr.id=pp.priere_id WHERE pp.personnage_id=v_pc.personnage_id;
  END IF;

  v_items_detail := v_items_comp || v_items_sorts || v_items_prieres;
  v_xp_rembourse := v_xp_comp + v_xp_sorts + v_xp_prieres;
  v_cascade := (v_nb_comp_distinct > 1) OR v_purge_sorts OR v_purge_prieres;
  v_donnees := jsonb_build_object('cascade',v_cascade,'competence_cible',v_comp.nom,'count_competences',v_nb_comp,'count_competences_distinctes',v_nb_comp_distinct,'count_sorts',v_nb_sorts,'count_prieres',v_nb_prieres,'xp_rembourse',v_xp_rembourse,'items_detail',v_items_detail);

  IF p_dry_run THEN RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',v_donnees); END IF;

  v_log := public.doit_logger_action(v_perso.joueur_id);

  IF v_purge_sorts THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, sort_id) SELECT v_pc.personnage_id,'remboursement',ps.xp_depense,format('Désachat en cascade « Acquisition de Sort » — sort « %s »',COALESCE(ps.nom_personnalise,s.nom)),v_uid,ps.sort_id FROM personnage_sorts ps JOIN sorts s ON s.id=ps.sort_id WHERE ps.personnage_id=v_pc.personnage_id AND ps.xp_depense>0;
    IF v_log THEN
      FOR v_item IN SELECT COALESCE(ps.nom_personnalise,s.nom) AS nom, ps.xp_depense FROM personnage_sorts ps JOIN sorts s ON s.id=ps.sort_id WHERE ps.personnage_id=v_pc.personnage_id LOOP
        PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_sort', jsonb_build_object('nom', v_item.nom, 'xp_rembourse', v_item.xp_depense, 'cascade', true, 'competence_origine', v_comp.nom));
      END LOOP;
    END IF;
    DELETE FROM personnage_sorts WHERE personnage_id=v_pc.personnage_id;
  END IF;
  IF v_purge_prieres THEN
    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, acteur_id, priere_id) SELECT v_pc.personnage_id,'remboursement',pp.xp_depense,format('Désachat en cascade « Acquisition de Prière » — prière « %s »',COALESCE(pp.nom_personnalise,pr.nom)),v_uid,pp.priere_id FROM personnage_prieres pp JOIN prieres pr ON pr.id=pp.priere_id WHERE pp.personnage_id=v_pc.personnage_id AND pp.xp_depense>0;
    IF v_log THEN
      FOR v_item IN SELECT COALESCE(pp.nom_personnalise,pr.nom) AS nom, pp.xp_depense FROM personnage_prieres pp JOIN prieres pr ON pr.id=pp.priere_id WHERE pp.personnage_id=v_pc.personnage_id LOOP
        PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_priere', jsonb_build_object('nom', v_item.nom, 'xp_rembourse', v_item.xp_depense, 'cascade', true, 'competence_origine', v_comp.nom));
      END LOOP;
    END IF;
    DELETE FROM personnage_prieres WHERE personnage_id=v_pc.personnage_id;
  END IF;
  INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
  SELECT v_pc.personnage_id,'remboursement',pc.xp_depense,
    format('Désachat en cascade — %s%s niveau %s', c.nom,
      CASE WHEN pc.choix_achat IS NOT NULL THEN format(' (%s)', pc.choix_achat) ELSE '' END,
      pc.niveau_acquis),
    pc.competence_id, v_uid
  FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id
  WHERE pc.id = ANY(v_removal_ids) AND pc.xp_depense > 0;
  IF v_log THEN
    FOR v_item IN SELECT c.nom, pc.competence_id AS cid, pc.niveau_acquis, pc.choix_achat, pc.xp_depense FROM personnage_competences pc JOIN competences c ON c.id=pc.competence_id WHERE pc.id = ANY(v_removal_ids) ORDER BY c.nom, pc.niveau_acquis LOOP
      PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_competence', jsonb_build_object('nom', v_item.nom, 'niveau', v_item.niveau_acquis, 'choix', v_item.choix_achat, 'xp_rembourse', v_item.xp_depense, 'cascade', v_item.cid <> v_pc.competence_id, 'competence_origine', v_comp.nom));
    END LOOP;
  END IF;
  DELETE FROM personnage_competences WHERE id = ANY(v_removal_ids);

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres FROM personnages WHERE id = v_pc.personnage_id;
  v_donnees := v_donnees || jsonb_build_object('xp_total',v_xp_total_apres,'xp_depense',v_xp_depense_apres,'xp_restant',v_xp_total_apres - v_xp_depense_apres);
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',v_donnees);
END;
$function$;

-- ============ B1. sauvegarder_etape_1 (gate moderne + campagne partielle INV-4/INV-5) ============
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_1(p_personnage_id uuid, p_nom text, p_gn_completes integer, p_mini_gn_completes integer, p_ouvertures_terrain integer, p_est_croyant boolean, p_religion_id uuid, p_historique text DEFAULT NULL::text, p_ame_personnage text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_validation jsonb;
  v_etape_apres integer;
  v_blocage jsonb;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(p_personnage_id)->>'etat') = 'campagne' THEN
      -- INV-4 : identité figée. INV-5 : historique + âme restent libres.
      IF p_nom IS DISTINCT FROM v_perso.nom
         OR p_gn_completes IS DISTINCT FROM v_perso.gn_completes
         OR p_mini_gn_completes IS DISTINCT FROM v_perso.mini_gn_completes
         OR p_ouvertures_terrain IS DISTINCT FROM v_perso.ouvertures_terrain
         OR p_est_croyant IS DISTINCT FROM v_perso.est_croyant
         OR p_religion_id IS DISTINCT FROM v_perso.religion_id THEN
        RETURN jsonb_build_object('succes', false,
          'erreurs', jsonb_build_array(jsonb_build_object('code', 'identite_figee_campagne',
            'message', 'En campagne, l''identité du personnage est figée (nom, compteurs d''expérience, croyance). Seuls l''historique et l''âme du personnage restent modifiables.')),
          'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
      END IF;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;
  BEGIN
    UPDATE public.personnages
    SET nom = p_nom, gn_completes = p_gn_completes, mini_gn_completes = p_mini_gn_completes,
        ouvertures_terrain = p_ouvertures_terrain, est_croyant = p_est_croyant, religion_id = p_religion_id,
        historique = COALESCE(p_historique, historique),
        ame_personnage = COALESCE(p_ame_personnage, ame_personnage)
    WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  v_validation := public.valider_etape_1(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs', 'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;
  IF v_perso.etape_creation = 1 THEN
    UPDATE public.personnages SET etape_creation = 2 WHERE id = p_personnage_id;
    v_etape_apres := 2;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'sauvegarder_etape_1', jsonb_build_object('etape', 1));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;

-- ============ B2. sauvegarder_etape_2 (gate moderne) ============
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_2(p_personnage_id uuid, p_race_id uuid, p_sous_type_chimeride text DEFAULT NULL::text, p_justification text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_race_nom text;
  v_validation jsonb;
  v_etape_apres integer;
  v_demande_resultat jsonb;
  v_demande_existante boolean;
  v_race_changee boolean;
  v_avertissements jsonb := '[]'::jsonb;
  v_blocage jsonb;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  v_race_changee := (v_perso.race_id IS DISTINCT FROM p_race_id);
  BEGIN
    UPDATE public.personnages SET race_id = p_race_id, sous_type_chimeride = p_sous_type_chimeride
     WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  SELECT nom INTO v_race_nom FROM public.races WHERE id = p_race_id;
  -- Demande de race (Option 2, s112) : la demande suit la race courante.
  -- Si la race change, on repart d'une demande fraiche ; si la nouvelle race
  -- n'est pas speciale, on nettoie toute demande devenue obsolete.
  -- p_justification est ignore (compat signature) ; background issu de l historique.
  IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
    IF v_race_changee THEN
      DELETE FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id;
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id) INTO v_demande_existante;
    IF NOT v_demande_existante THEN
      v_demande_resultat := public.creer_demande_race(p_personnage_id, v_perso.historique);
      IF NOT COALESCE((v_demande_resultat->>'succes')::boolean, false) THEN
        v_avertissements := v_avertissements || jsonb_build_object(
          'code', 'demande_race_echec',
          'message', COALESCE(v_demande_resultat->>'erreur', 'Création de la demande de race échouée.'));
      END IF;
    END IF;
  ELSIF v_race_changee THEN
    DELETE FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id;
  END IF;
  v_validation := public.valider_etape_2(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', (v_validation->'avertissements') || v_avertissements,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;
  IF v_perso.etape_creation = 2 THEN
    UPDATE public.personnages SET etape_creation = 3 WHERE id = p_personnage_id;
    v_etape_apres := 3;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'sauvegarder_etape_2', jsonb_build_object('etape', 2));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', v_avertissements,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;

-- ============ B3. sauvegarder_etape_3 (gate moderne) ============
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_3(p_personnage_id uuid, p_traits_raciaux_choisis jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer;
  v_old_traits jsonb;
  v_new_traits jsonb := '[]'::jsonb;
  v_validation jsonb;
  v_etape_apres integer;
  v_trait jsonb;
  v_old_elem jsonb;
  v_trait_id uuid;
  v_cout_xp integer;
  v_est_gratuit boolean;
  v_trait_nom text;
  v_index integer := 0;
  v_old_xp_depense integer;
  v_new_xp_depense integer;
  v_blocage jsonb;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(p_personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race FROM public.races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);
  v_old_traits := COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb);

  FOR v_trait IN SELECT value FROM jsonb_array_elements(COALESCE(p_traits_raciaux_choisis, '[]'::jsonb))
  LOOP
    v_trait_id := (v_trait->>'trait_id')::uuid;
    IF v_index < v_nb_traits_gratuits_race THEN
      v_est_gratuit := true; v_cout_xp := 0;
    ELSE
      v_est_gratuit := false;
      SELECT cout_xp INTO v_cout_xp FROM public.vue_traits_par_race
       WHERE race_id = v_perso.race_id AND trait_id = v_trait_id LIMIT 1;
      v_cout_xp := COALESCE(v_cout_xp, 0);
    END IF;
    v_new_traits := v_new_traits || jsonb_build_array(jsonb_build_object(
      'trait_id', v_trait_id, 'est_gratuit', v_est_gratuit, 'xp_depense', v_cout_xp));
    v_index := v_index + 1;
  END LOOP;

  BEGIN
    FOR v_old_elem IN SELECT value FROM jsonb_array_elements(v_old_traits)
    LOOP
      v_trait_id := (v_old_elem->>'trait_id')::uuid;
      v_old_xp_depense := COALESCE((v_old_elem->>'xp_depense')::integer, 0);
      v_new_xp_depense := NULL;
      SELECT (elem->>'xp_depense')::integer INTO v_new_xp_depense
        FROM jsonb_array_elements(v_new_traits) elem
        WHERE (elem->>'trait_id')::uuid = v_trait_id LIMIT 1;

      IF v_new_xp_depense IS NULL THEN
        IF v_old_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'remboursement', v_old_xp_depense,
                  format('Remboursement trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      ELSIF v_new_xp_depense <> v_old_xp_depense THEN
        IF v_old_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'remboursement', v_old_xp_depense,
                  format('Remboursement trait racial (reorganisation) : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
        IF v_new_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'depense_trait', -v_new_xp_depense,
                  format('Achat trait racial (reorganisation) : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      END IF;
    END LOOP;

    FOR v_trait IN SELECT value FROM jsonb_array_elements(v_new_traits)
    LOOP
      v_trait_id := (v_trait->>'trait_id')::uuid;
      v_cout_xp := COALESCE((v_trait->>'xp_depense')::integer, 0);
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_old_traits) elem
        WHERE (elem->>'trait_id')::uuid = v_trait_id
      ) THEN
        IF v_cout_xp > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
                  format('Achat trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      END IF;
    END LOOP;

    UPDATE public.personnages SET traits_raciaux_choisis = v_new_traits WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;

  v_validation := public.valider_etape_3(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs', 'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;

  IF v_perso.etape_creation = 3 THEN
    UPDATE public.personnages SET etape_creation = 4 WHERE id = p_personnage_id;
    v_etape_apres := 4;
  ELSE v_etape_apres := v_perso.etape_creation; END IF;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'sauvegarder_etape_3', jsonb_build_object('etape', 3));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres,
      'traits_raciaux_choisis', v_new_traits));
END;
$function$;

-- ============ B4. sauvegarder_etape_4 (gate moderne) ============
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_4(p_personnage_id uuid, p_classe_id uuid, p_choix_par_competence jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_validation jsonb;
  v_attribution jsonb;
  v_cc jsonb;
  v_etape_apres integer;
  v_blocage jsonb;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'non_authentifie', 'message', 'Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  IF v_perso.classe_id IS NOT NULL AND p_classe_id IS DISTINCT FROM v_perso.classe_id THEN
    v_cc := public.changer_classe_personnage(p_personnage_id, p_classe_id, p_choix_par_competence, false);
    IF NOT (v_cc->>'succes')::boolean THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', v_cc->'erreurs', 'avertissements', COALESCE(v_cc->'avertissements','[]'::jsonb),
        'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
    END IF;
  ELSE
    BEGIN
      UPDATE public.personnages SET classe_id = p_classe_id WHERE id = p_personnage_id;
    EXCEPTION WHEN check_violation OR foreign_key_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
    END;
    v_attribution := public.attribuer_competences_gratuites_classe(p_personnage_id, COALESCE(p_choix_par_competence, '{}'::jsonb));
    IF NOT (v_attribution->>'succes')::boolean THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', v_attribution->'erreurs', 'avertissements', v_attribution->'avertissements',
        'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
    END IF;
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  v_validation := public.valider_etape_4(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs', 'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;
  IF v_perso.etape_creation = 4 THEN
    UPDATE public.personnages SET etape_creation = 5 WHERE id = p_personnage_id;
    v_etape_apres := 5;
  ELSE v_etape_apres := v_perso.etape_creation; END IF;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'sauvegarder_etape_4', jsonb_build_object('etape', 4));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;
