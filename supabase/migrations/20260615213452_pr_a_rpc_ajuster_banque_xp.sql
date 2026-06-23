CREATE OR REPLACE FUNCTION public.ajuster_banque_xp(
  p_joueur_id uuid,
  p_montant integer,
  p_description text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_compte_id    uuid;
  v_nom_profil   text;
  v_description  text;
  v_mouvement_id uuid;
  v_solde_apres  integer;
BEGIN
  -- Gate staff
  IF NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','acces_refuse','message','Action réservée au staff.')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  -- Montant non nul
  IF p_montant IS NULL OR p_montant = 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','montant_invalide','message','Le montant doit être non nul.','champ','montant')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  -- Description obligatoire
  v_description := NULLIF(trim(COALESCE(p_description, '')), '');
  IF v_description IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','description_obligatoire','message','Une description est obligatoire.','champ','description')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  -- Profil existe → on récupère le compte pour la notification
  SELECT compte_id, nom INTO v_compte_id, v_nom_profil
  FROM public.profils_joueur WHERE id = p_joueur_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','profil_introuvable','message','Profil de jeu introuvable.','champ','joueur_id')),
      'avertissements', '[]'::jsonb, 'donnees', NULL);
  END IF;

  -- Mouvement de banque : AUCUN garde-fou (solde négatif autorisé)
  INSERT INTO public.banque_xp_mouvements
    (joueur_id, type_mouvement, montant, evenement_id, personnage_cible_id, acteur_id, description)
  VALUES
    (p_joueur_id, 'ajustement_admin', p_montant, NULL, NULL, auth.uid(), v_description)
  RETURNING id INTO v_mouvement_id;

  SELECT COALESCE(SUM(montant), 0) INTO v_solde_apres
  FROM public.banque_xp_mouvements WHERE joueur_id = p_joueur_id;

  -- Notification : vers le COMPTE derrière le profil (correct en multi-profils)
  INSERT INTO public.notifications (user_id, message)
  VALUES (v_compte_id,
    format('Ajustement de %s%s XP sur la banque du profil « %s » : %s',
      CASE WHEN p_montant > 0 THEN '+' ELSE '' END, p_montant,
      COALESCE(v_nom_profil, 'Sans nom'), v_description));

  -- Journalisation
  PERFORM public.log_audit('banque', p_joueur_id, 'ajustement_admin',
    jsonb_build_object('montant', p_montant, 'description', v_description,
                       'mouvement_id', v_mouvement_id, 'solde_apres', v_solde_apres));

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('mouvement_id', v_mouvement_id, 'montant', p_montant, 'solde_apres', v_solde_apres));
END;
$function$;
