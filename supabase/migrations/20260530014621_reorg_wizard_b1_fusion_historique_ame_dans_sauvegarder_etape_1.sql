-- Réorganisation wizard PR-B1 : fusion étape 10 (Historique/Âme) dans étape 1.
-- Enrichit sauvegarder_etape_1 avec p_historique + p_ame_personnage (DEFAULT NULL).
-- Additif, non-breaking : COALESCE préserve l'existant si param NULL (ancien frontend 7-params).
-- sauvegarder_etape_10 CONSERVÉE (droppée en PR-B2).

DROP FUNCTION IF EXISTS public.sauvegarder_etape_1(uuid, text, integer, integer, integer, boolean, uuid);

CREATE OR REPLACE FUNCTION public.sauvegarder_etape_1(
  p_personnage_id uuid,
  p_nom text,
  p_gn_completes integer,
  p_mini_gn_completes integer,
  p_ouvertures_terrain integer,
  p_est_croyant boolean,
  p_religion_id uuid,
  p_historique text DEFAULT NULL,
  p_ame_personnage text DEFAULT NULL
)
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
  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'ownership_refuse', 'message', 'Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_verrouille',
        'message', 'Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
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
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;
