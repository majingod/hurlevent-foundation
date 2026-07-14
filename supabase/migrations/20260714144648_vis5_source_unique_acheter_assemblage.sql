-- [VIS-5] Source unique des règles d'achat : acheter_assemblage délègue à peut_acheter_assemblage.
-- Comportement inchangé (diff s331 : 0 dérive). Le réconciliateur reste l'autorité gratuit/ledger. Idempotent.
CREATE OR REPLACE FUNCTION public.acheter_assemblage(p_personnage_id uuid, p_assemblage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_uid          uuid := auth.uid();
  v_perso        personnages%ROWTYPE;
  v_check        jsonb;
  v_new_id       uuid;
  v_ligne        personnage_assemblages%ROWTYPE;
  v_xp_total     integer;
  v_xp_depense   integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = p_personnage_id FOR UPDATE;
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

  v_blocage := public.gate_edition_personnage(p_personnage_id, 'ajout');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  -- [VIS-5] source unique : toutes les règles d'achat vivent dans peut_acheter_assemblage
  v_check := public.peut_acheter_assemblage(p_personnage_id, p_assemblage_id);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', v_check->>'code', 'message', v_check->>'raison')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    INSERT INTO personnage_assemblages (personnage_id, assemblage_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_assemblage_id, 0, false)
    RETURNING id INTO v_new_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  PERFORM public.reconcilier_assemblages(p_personnage_id);

  SELECT * INTO v_ligne FROM personnage_assemblages WHERE id = v_new_id;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'acheter_assemblage', jsonb_build_object('assemblage_id', p_assemblage_id, 'nom', (SELECT nom FROM assemblages_runes WHERE id = p_assemblage_id), 'cout_xp', v_ligne.xp_depense));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_ligne.est_gratuit,
      'xp_depense_achat', v_ligne.xp_depense,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- A37 : re-verrouillage ACL après CREATE OR REPLACE
REVOKE EXECUTE ON FUNCTION public.acheter_assemblage(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acheter_assemblage(uuid, uuid) TO authenticated;
