-- Lot 2 PR2 : journal d'audit sur transferer_banque_vers_personnage.
-- Refactor neutre : ajout d'1 ligne journal (cible_type='banque'), aucun mouvement banque/XP modifié.
-- crediter_banque_xp volontairement NON journalisé (Option 1) : son seul appelant est
-- attribuer_xp_evenement, déjà journalisé en PR1 ; le gain est aussi tracé dans le registre banque.
-- Signature inchangée -> CREATE OR REPLACE safe, pas de DROP.
CREATE OR REPLACE FUNCTION public.transferer_banque_vers_personnage(p_personnage_cible_id uuid, p_montant integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_perso RECORD; v_solde integer; v_banque_id uuid; v_desc text; v_xp_total integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','NON_AUTHENTIFIE','message','Authentification requise.')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF p_montant IS NULL OR p_montant <= 0 THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','MONTANT_INVALIDE','message','Le montant doit être > 0.','champ','p_montant')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT id,nom,joueur_id INTO v_perso FROM public.personnages WHERE id=p_personnage_cible_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','PERSONNAGE_INTROUVABLE','message','Personnage introuvable.','champ','p_personnage_cible_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  IF NOT public.compte_voit_joueur(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ACCES_REFUSE','message','Ce personnage ne vous appartient pas.','champ','p_personnage_cible_id')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  SELECT COALESCE(SUM(montant),0) INTO v_solde FROM public.banque_xp_mouvements WHERE joueur_id=v_perso.joueur_id;
  IF p_montant > v_solde THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','SOLDE_INSUFFISANT','message',format('Solde insuffisant (%s dispo, %s demandé).',v_solde,p_montant),'champ','p_montant')),'avertissements','[]'::jsonb,'donnees',null);
  END IF;
  v_desc := format('Versement banque XP vers %s',COALESCE(v_perso.nom,'personnage'));
  INSERT INTO public.banque_xp_mouvements (joueur_id,type_mouvement,montant,personnage_cible_id,acteur_id,description)
  VALUES (v_perso.joueur_id,'transfert_vers_personnage',-p_montant,p_personnage_cible_id,v_uid,v_desc) RETURNING id INTO v_banque_id;
  INSERT INTO public.historique_xp (personnage_id,type_mouvement,montant,description,acteur_id,banque_mouvement_id)
  VALUES (p_personnage_cible_id,'gain_banque',p_montant,v_desc,v_uid,v_banque_id);
  SELECT COALESCE(SUM(montant),0) INTO v_solde FROM public.banque_xp_mouvements WHERE joueur_id=v_perso.joueur_id;
  SELECT xp_total INTO v_xp_total FROM public.personnages WHERE id=p_personnage_cible_id;
  -- Lot 2 PR2 : trace au journal d'audit (cible_type='banque', cohérent avec ajuster_banque_xp).
  PERFORM public.log_audit('banque', v_perso.joueur_id, 'transfert_vers_personnage',
    jsonb_build_object('montant',p_montant,'personnage_id',p_personnage_cible_id,'personnage_nom',v_perso.nom,'solde_apres',v_solde,'banque_mouvement_id',v_banque_id));
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,
    'donnees',jsonb_build_object('xp_verse',p_montant,'nouveau_solde',v_solde,'perso_xp_total',v_xp_total,'banque_mouvement_id',v_banque_id));
END;
$function$;
