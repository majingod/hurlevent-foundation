-- [VIS-5 volet b, s332] sauvegarder_etape_4 : retrait de l'appel post-cascade a
-- attribuer_competences_gratuites_classe dans la branche CHANGEMENT de classe.
-- Le guichet public.changer_classe_personnage (migration precedente) fait desormais
-- cascade + attribuer d'un seul geste ; l'appel d'ici etait devenu redondant
-- (idempotent mais double). La branche MEME CLASSE garde son appel (necessaire).
-- Idempotent : CREATE OR REPLACE + re-verrouillage ACL (Gotcha A37).

CREATE OR REPLACE FUNCTION public.sauvegarder_etape_4(p_personnage_id uuid, p_classe_id uuid, p_choix_par_competence jsonb DEFAULT NULL::jsonb, p_brouillon boolean DEFAULT false)
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

  -- Brouillon (persist-au-choix, s217) : persiste UNIQUEMENT classe_id.
  -- Aucune attribution de competences gratuites, aucune validation, aucun
  -- avancement d'etape, aucun log. Miroir du contrat brouillon e2/e3.
  IF p_brouillon THEN
    BEGIN
      UPDATE public.personnages SET classe_id = p_classe_id WHERE id = p_personnage_id;
    EXCEPTION WHEN check_violation OR foreign_key_violation THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
    END;
    RETURN jsonb_build_object('succes', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'brouillon', true,
        'etape_creation_apres', v_perso.etape_creation));
  END IF;

  IF v_perso.classe_id IS NOT NULL AND p_classe_id IS DISTINCT FROM v_perso.classe_id THEN
    v_cc := public.changer_classe_personnage(p_personnage_id, p_classe_id, p_choix_par_competence, false);
    IF NOT (v_cc->>'succes')::boolean THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', v_cc->'erreurs', 'avertissements', COALESCE(v_cc->'avertissements','[]'::jsonb),
        'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
    END IF;
    -- [VIS-5 volet b, s332] : le guichet changer_classe_personnage pose desormais
    -- lui-meme l'additif (cascade interne PUIS attribuer_competences_gratuites_classe).
    -- L'appel post-cascade d'ici (FIX s322) est devenu redondant -> retire.
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

-- A37 : CREATE OR REPLACE reinitialise l'ACL a PUBLIC -> re-verrouillage
REVOKE ALL ON FUNCTION public.sauvegarder_etape_4(uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sauvegarder_etape_4(uuid, uuid, jsonb, boolean) TO authenticated;
