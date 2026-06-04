-- Races speciales (Chimeride, Les Non-Races) : on retire le minimum de 100
-- caracteres et on alimente la demande d approbation depuis personnages.historique.
-- 2 RPC : creer_demande_race (retrait garde min) + sauvegarder_etape_2 (lit historique,
-- cree toujours une demande, p_justification ignore mais conserve pour compat signature).

CREATE OR REPLACE FUNCTION public.creer_demande_race(p_personnage_id uuid, p_background text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_personnage RECORD;
  v_race RECORD;
  v_demande_id uuid;
BEGIN
  SELECT * INTO v_personnage FROM public.personnages WHERE id = p_personnage_id;
  IF v_personnage IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Personnage introuvable');
  END IF;

  IF v_personnage.joueur_id != auth.uid() AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Accès refusé');
  END IF;

  SELECT * INTO v_race FROM public.races WHERE id = v_personnage.race_id;
  IF v_race.nom NOT IN ('Chiméride', 'Les Non-Races') THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Cette race ne nécessite pas d''approbation');
  END IF;

  IF EXISTS (SELECT 1 FROM public.personnage_races_demandes
             WHERE personnage_id = p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreur', 'Une demande existe déjà pour ce personnage');
  END IF;

  -- Plus de longueur minimale : background issu de l historique (peut etre vide -> NULL)
  INSERT INTO public.personnage_races_demandes (personnage_id, race_id, background)
  VALUES (p_personnage_id, v_personnage.race_id, NULLIF(trim(COALESCE(p_background, '')), ''))
  RETURNING id INTO v_demande_id;

  INSERT INTO public.notifications (user_id, type, message, reference_id, statut)
  SELECT
    p.id,
    'demande_race_nouvelle',
    format('📋 Nouvelle demande de race : "%s" pour le personnage "%s"',
           v_race.nom, v_personnage.nom),
    v_demande_id,
    'non_traite'
  FROM public.profiles p
  WHERE p.role IN ('admin', 'animateur')
    AND COALESCE(p.is_active, true) = true;

  RETURN jsonb_build_object(
    'succes', true,
    'message', 'Demande créée. Les administrateurs vont l''examiner.',
    'demande_id', v_demande_id
  );
END;
$function$;

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
  v_avertissements jsonb := '[]'::jsonb;
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
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;
  BEGIN
    UPDATE public.personnages SET race_id = p_race_id, sous_type_chimeride = p_sous_type_chimeride
     WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  SELECT nom INTO v_race_nom FROM public.races WHERE id = p_race_id;
  -- Races speciales : on cree TOUJOURS une demande, alimentee par l historique
  -- (etape 1), sans longueur minimale. p_justification est ignore (compat signature).
  IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
    SELECT EXISTS (SELECT 1 FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id) INTO v_demande_existante;
    IF NOT v_demande_existante THEN
      v_demande_resultat := public.creer_demande_race(p_personnage_id, v_perso.historique);
      IF NOT COALESCE((v_demande_resultat->>'succes')::boolean, false) THEN
        v_avertissements := v_avertissements || jsonb_build_object(
          'code', 'demande_race_echec',
          'message', COALESCE(v_demande_resultat->>'erreur', 'Création de la demande de race échouée.'));
      END IF;
    END IF;
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
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', v_avertissements,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;
