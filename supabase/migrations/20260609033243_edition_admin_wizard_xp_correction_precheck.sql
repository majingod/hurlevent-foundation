CREATE OR REPLACE FUNCTION public.corriger_xp_personnage(
  p_personnage_id uuid, p_montant integer, p_raison text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_perso RECORD; v_description text; v_total_apres integer; v_dispo_apres integer;
BEGIN
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Action réservée au staff.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;
  IF p_montant IS NULL OR p_montant = 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','montant_invalide','message','Le montant doit être non nul.','champ','montant')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;
  SELECT id, nom, joueur_id, xp_total, xp_depense INTO v_perso
  FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;
  v_total_apres := v_perso.xp_total + p_montant;
  IF v_total_apres < v_perso.xp_depense THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','correction_excessive',
        'message', format('Retrait impossible : %s XP non dépensés seulement. Désacheter des éléments d''abord pour libérer de l''XP.',
                          v_perso.xp_total - v_perso.xp_depense),
        'champ','montant')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;
  v_description := CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0
    THEN 'Correction : ' || trim(p_raison) ELSE 'Correction XP par le staff' END;
  INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, acteur_id)
  VALUES (p_personnage_id, 'gain_correction', p_montant, v_description, auth.uid());
  INSERT INTO public.notifications (user_id, message)
  VALUES (v_perso.joueur_id,
    format('Correction de %s%s XP appliquée à « %s »%s.',
      CASE WHEN p_montant > 0 THEN '+' ELSE '' END, p_montant,
      COALESCE(v_perso.nom, 'Sans nom'),
      CASE WHEN p_raison IS NOT NULL AND length(trim(p_raison)) > 0 THEN ' : ' || trim(p_raison) ELSE '' END));
  v_dispo_apres := v_total_apres - v_perso.xp_depense;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('xp_corrige', p_montant, 'xp_total', v_total_apres, 'xp_disponible', v_dispo_apres));
END;
$function$;
