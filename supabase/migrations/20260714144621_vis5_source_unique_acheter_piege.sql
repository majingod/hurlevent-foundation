-- [VIS-5] Source unique des règles d'achat : acheter_piege délègue à peut_acheter_piege.
-- Comportement inchangé (diff s331 : 0 dérive). Coût XP et est_gratuit repris de la gate. Idempotent.
CREATE OR REPLACE FUNCTION public.acheter_piege(p_personnage_id uuid, p_piege_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid uuid := auth.uid(); v_perso personnages%ROWTYPE; v_piege pieges%ROWTYPE;
  v_check jsonb;
  v_est_gratuit boolean; v_cout_xp integer; v_new_id uuid; v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  SELECT * INTO v_perso FROM personnages WHERE id=p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),'avertissements','[]'::jsonb,'donnees','{}'::jsonb); END IF;
  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;
  -- [VIS-5] source unique : toutes les règles d'achat vivent dans peut_acheter_piege
  v_check := public.peut_acheter_piege(p_personnage_id, p_piege_id);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes',false,
      'erreurs',jsonb_build_array(jsonb_build_object('code', v_check->>'code', 'message', v_check->>'raison')),
      'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END IF;
  v_cout_xp := (v_check->>'cout_xp')::integer;
  v_est_gratuit := (v_check->>'est_gratuit')::boolean;
  SELECT * INTO v_piege FROM pieges WHERE id=p_piege_id;
  BEGIN
    INSERT INTO personnage_pieges (personnage_id,piege_nom,niveau_acquis,piege_id,xp_depense,est_gratuit)
    VALUES (p_personnage_id,v_piege.nom,v_piege.niveau,p_piege_id,v_cout_xp,v_est_gratuit) RETURNING id INTO v_new_id;
    IF NOT v_est_gratuit AND v_cout_xp>0 THEN
      INSERT INTO historique_xp (personnage_id,type_mouvement,montant,description,piege_id,acteur_id)
      VALUES (p_personnage_id,'depense_piege',-v_cout_xp,'Achat piège « '||v_piege.nom||' » niveau '||v_piege.niveau||' ('||v_cout_xp||' XP)',p_piege_id,v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes',false,'erreurs',jsonb_build_array(jsonb_build_object('code','contrainte_violee','message',SQLERRM)),'avertissements','[]'::jsonb,'donnees','{}'::jsonb);
  END;
  SELECT xp_total,xp_depense INTO v_xp_total,v_xp_depense FROM personnages WHERE id=p_personnage_id;
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'acheter_piege', jsonb_build_object('piege_id', p_piege_id, 'nom', (SELECT nom FROM pieges WHERE id = p_piege_id), 'cout_xp', v_cout_xp));
  END IF;
  RETURN jsonb_build_object('succes',true,'erreurs','[]'::jsonb,'avertissements','[]'::jsonb,'donnees',jsonb_build_object('id',v_new_id,'piege_nom',v_piege.nom,'niveau_acquis',v_piege.niveau,'est_gratuit',v_est_gratuit,'xp_depense_palier',v_cout_xp,'xp_total',v_xp_total,'xp_depense',v_xp_depense,'xp_restant',v_xp_total-v_xp_depense));
END; $function$;

-- A37 : re-verrouillage ACL après CREATE OR REPLACE
REVOKE EXECUTE ON FUNCTION public.acheter_piege(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acheter_piege(uuid, uuid) TO authenticated;
