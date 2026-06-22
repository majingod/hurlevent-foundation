-- Fix B AUDIT-CASCADE-DETAIL : désachat en cascade détaillé par item
-- - historique_xp : 1 ligne par niveau de compétence retiré (au lieu du SUM groupé),
--   avec choix_achat dans la description quand non-null. Sorts/prières déjà par item.
-- - journal_audit : 1 log_audit par item retiré (compétence-niveau, sort, prière),
--   details = {nom, niveau, choix, xp_rembourse, cascade, competence_origine}.
--   Remplace l'unique log final (compétence cible seule).
-- Invariant : SUM(historique_xp) == xp_rembourse (mêmes sources, dé-groupées).

CREATE OR REPLACE FUNCTION public.desacheter_competence(p_personnage_competence_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  v_blocage jsonb;
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
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
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
$fn$;
