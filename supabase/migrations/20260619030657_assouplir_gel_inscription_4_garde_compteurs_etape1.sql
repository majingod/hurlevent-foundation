CREATE OR REPLACE FUNCTION public.sauvegarder_etape_1(p_personnage_id uuid, p_nom text, p_gn_completes integer, p_mini_gn_completes integer, p_ouvertures_terrain integer, p_est_croyant boolean, p_religion_id uuid, p_historique text DEFAULT NULL::text, p_ame_personnage text DEFAULT NULL::text, p_brouillon boolean DEFAULT false)
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
  -- Rattrapage figé dès l'inscription (cas remodelage_libre inscrit, hors campagne déjà gérée)
  IF v_blocage IS NULL AND NOT public.est_admin() THEN
    IF NOT (public.etat_edition_personnage(p_personnage_id)->>'rattrapage_editable')::boolean THEN
      IF p_gn_completes IS DISTINCT FROM v_perso.gn_completes
         OR p_mini_gn_completes IS DISTINCT FROM v_perso.mini_gn_completes
         OR p_ouvertures_terrain IS DISTINCT FROM v_perso.ouvertures_terrain THEN
        RETURN jsonb_build_object('succes', false,
          'erreurs', jsonb_build_array(jsonb_build_object('code', 'rattrapage_fige_inscription',
            'message', 'Tes compteurs d''expérience sont figés tant que tu es inscrit à un événement. Désinscris-toi pour les modifier.')),
          'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
      END IF;
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
  IF p_brouillon THEN
    RETURN jsonb_build_object('succes', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'brouillon', true,
        'etape_creation_apres', v_perso.etape_creation));
  END IF;
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
