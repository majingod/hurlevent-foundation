-- Phase 1.6.2 — RPC sauvegarder_etape_2, 3, 4, 10
-- Format de retour standardisé : { succes, erreurs, avertissements, donnees }
-- Codes erreur snake_case minuscule, ownership via auth.uid() + est_animateur_ou_admin(),
-- vérification est_verrouille=false, sauvegarde partielle conservée si validation échoue,
-- transition d'étape uniquement si etape_creation = N AVANT ET valider_etape_N renvoie valide=true.

-- ============================================================================
-- ÉTAPE 2 : Race (+ sous-type Chiméride + demande race spéciale)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_2(
  p_personnage_id uuid,
  p_race_id uuid,
  p_sous_type_chimeride text DEFAULT NULL,
  p_justification text DEFAULT NULL
)
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
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_introuvable',
        'message', 'Personnage introuvable.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'ownership_refuse',
        'message', 'Ce personnage ne vous appartient pas.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_verrouille',
        'message', 'Ce personnage est verrouillé et ne peut plus être modifié.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  -- UPDATE : race + sous_type_chimeride
  BEGIN
    UPDATE public.personnages
    SET
      race_id = p_race_id,
      sous_type_chimeride = p_sous_type_chimeride
    WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'contrainte_violee',
        'message', SQLERRM
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  -- Si race spéciale (Chiméride / Les Non-Races), créer la demande si absente.
  -- On garde la logique existante de creer_demande_race qui valide background >= 100 chars.
  SELECT nom INTO v_race_nom FROM public.races WHERE id = p_race_id;

  IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.personnage_races_demandes
      WHERE personnage_id = p_personnage_id
    ) INTO v_demande_existante;

    IF NOT v_demande_existante THEN
      IF p_justification IS NULL OR char_length(trim(p_justification)) < 100 THEN
        v_avertissements := v_avertissements || jsonb_build_object(
          'code', 'justification_race_speciale_requise',
          'message', 'Cette race nécessite une demande d''approbation avec une justification d''au moins 100 caractères.'
        );
      ELSE
        v_demande_resultat := public.creer_demande_race(p_personnage_id, p_justification);
        IF NOT COALESCE((v_demande_resultat->>'succes')::boolean, false) THEN
          v_avertissements := v_avertissements || jsonb_build_object(
            'code', 'demande_race_echec',
            'message', COALESCE(v_demande_resultat->>'erreur', 'Création de la demande de race échouée.')
          );
        END IF;
      END IF;
    END IF;
  END IF;

  v_validation := public.valider_etape_2(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', (v_validation->'avertissements') || v_avertissements,
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  IF v_perso.etape_creation = 2 THEN
    UPDATE public.personnages SET etape_creation = 3 WHERE id = p_personnage_id;
    v_etape_apres := 3;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', v_avertissements,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres
    )
  );
END;
$function$;

-- ============================================================================
-- ÉTAPE 3 : Traits raciaux (gratuits + payants via historique_xp)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_3(
  p_personnage_id uuid,
  p_traits_raciaux_choisis jsonb
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
  v_trait jsonb;
  v_trait_id uuid;
  v_est_gratuit boolean;
  v_xp_depense integer;
  v_trait_nom text;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_introuvable',
        'message', 'Personnage introuvable.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'ownership_refuse',
        'message', 'Ce personnage ne vous appartient pas.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_verrouille',
        'message', 'Ce personnage est verrouillé et ne peut plus être modifié.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  -- Sauvegarde idempotente : on remplace les dépenses 'depense_trait' existantes
  -- et on réécrit le JSON. Le trigger sync_xp_personnage recalcule xp_depense.
  BEGIN
    DELETE FROM public.historique_xp
    WHERE personnage_id = p_personnage_id
      AND type_mouvement = 'depense_trait';

    UPDATE public.personnages
    SET traits_raciaux_choisis = COALESCE(p_traits_raciaux_choisis, '[]'::jsonb)
    WHERE id = p_personnage_id;

    -- Insertion des traits payants dans historique_xp
    FOR v_trait IN SELECT * FROM jsonb_array_elements(COALESCE(p_traits_raciaux_choisis, '[]'::jsonb)) LOOP
      v_est_gratuit := COALESCE((v_trait->>'est_gratuit')::boolean, false);
      v_xp_depense := COALESCE((v_trait->>'xp_depense')::integer, 0);
      v_trait_id := (v_trait->>'trait_id')::uuid;

      IF NOT v_est_gratuit AND v_xp_depense > 0 THEN
        SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
        INSERT INTO public.historique_xp (
          personnage_id, type_mouvement, montant, description, trait_id, acteur_id
        ) VALUES (
          p_personnage_id,
          'depense_trait',
          -v_xp_depense,
          format('Achat trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
          v_trait_id,
          v_joueur_id
        );
      END IF;
    END LOOP;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'contrainte_violee',
        'message', SQLERRM
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  v_validation := public.valider_etape_3(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  IF v_perso.etape_creation = 3 THEN
    UPDATE public.personnages SET etape_creation = 4 WHERE id = p_personnage_id;
    v_etape_apres := 4;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres
    )
  );
END;
$function$;

-- ============================================================================
-- ÉTAPE 4 : Classe (simple UPDATE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_4(
  p_personnage_id uuid,
  p_classe_id uuid
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
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_introuvable',
        'message', 'Personnage introuvable.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'ownership_refuse',
        'message', 'Ce personnage ne vous appartient pas.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_verrouille',
        'message', 'Ce personnage est verrouillé et ne peut plus être modifié.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  BEGIN
    UPDATE public.personnages
    SET classe_id = p_classe_id
    WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'contrainte_violee',
        'message', SQLERRM
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  v_validation := public.valider_etape_4(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  IF v_perso.etape_creation = 4 THEN
    UPDATE public.personnages SET etape_creation = 5 WHERE id = p_personnage_id;
    v_etape_apres := 5;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres
    )
  );
END;
$function$;

-- ============================================================================
-- ÉTAPE 10 : Historique + Âme du personnage
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_10(
  p_personnage_id uuid,
  p_historique text,
  p_ame_personnage text
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
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_introuvable',
        'message', 'Personnage introuvable.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'ownership_refuse',
        'message', 'Ce personnage ne vous appartient pas.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_verrouille',
        'message', 'Ce personnage est verrouillé et ne peut plus être modifié.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END IF;

  BEGIN
    UPDATE public.personnages
    SET
      historique = p_historique,
      ame_personnage = p_ame_personnage
    WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'contrainte_violee',
        'message', SQLERRM
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id)
    );
  END;

  v_validation := public.valider_etape_10(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

  IF v_perso.etape_creation = 10 THEN
    UPDATE public.personnages SET etape_creation = 11 WHERE id = p_personnage_id;
    v_etape_apres := 11;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres
    )
  );
END;
$function$;
