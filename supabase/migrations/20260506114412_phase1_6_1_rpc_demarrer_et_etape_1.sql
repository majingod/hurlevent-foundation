
-- =========================================================================
-- Phase 1.6.1 — RPC d'action atomiques (1/6)
--
-- 1. demarrer_creation_personnage() : crée un brouillon pour auth.uid().
--    Refuse si un brouillon (non verrouillé ET actif) existe déjà.
--
-- 2. sauvegarder_etape_1(...) : sauvegarde les données de l'étape 1
--    (InfosBase). UPDATE conservé même si la validation échoue
--    (sauvegarde partielle). Transition vers étape 2 uniquement si
--    etape_creation = 1 ET valider_etape_1 retourne valide.
--
-- Format de retour standardisé Phase 1.6 :
--   { succes: bool, erreurs: jsonb[], avertissements: jsonb[], donnees: jsonb }
--
-- Codes d'erreur (snake_case minuscule, cohérent avec Phase 1.4) :
--   non_authentifie, brouillon_existant, personnage_introuvable,
--   ownership_refuse, personnage_verrouille, contrainte_violee
--   + erreurs propagées de valider_etape_1.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. demarrer_creation_personnage
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.demarrer_creation_personnage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_brouillon_id uuid;
  v_nouveau_id uuid;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'non_authentifie',
        'message', 'Authentification requise pour démarrer la création d''un personnage.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', '{}'::jsonb
    );
  END IF;

  -- Détection brouillon : non verrouillé ET non archivé
  SELECT id INTO v_brouillon_id
  FROM public.personnages
  WHERE joueur_id = v_joueur_id
    AND est_verrouille = false
    AND est_actif = true
  LIMIT 1;

  IF v_brouillon_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'brouillon_existant',
        'message', 'Vous avez déjà un personnage en cours de création.'
      )),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', v_brouillon_id)
    );
  END IF;

  v_nouveau_id := gen_random_uuid();
  INSERT INTO public.personnages (id, joueur_id) VALUES (v_nouveau_id, v_joueur_id);

  RETURN jsonb_build_object(
    'succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', v_nouveau_id,
      'etape_creation', 1
    )
  );
END;
$func$;

COMMENT ON FUNCTION public.demarrer_creation_personnage() IS
  'Phase 1.6.1 — Démarre la création d''un personnage pour auth.uid(). Retourne brouillon_existant (avec personnage_id du brouillon) si un perso non verrouillé et actif existe déjà pour ce joueur. Codes erreurs : non_authentifie, brouillon_existant.';

GRANT EXECUTE ON FUNCTION public.demarrer_creation_personnage() TO authenticated;

-- -------------------------------------------------------------------------
-- 2. sauvegarder_etape_1
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_1(
  p_personnage_id uuid,
  p_nom text,
  p_gn_completes integer,
  p_mini_gn_completes integer,
  p_ouvertures_terrain integer,
  p_est_croyant boolean,
  p_religion_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
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

  SELECT * INTO v_perso
  FROM public.personnages
  WHERE id = p_personnage_id
  FOR UPDATE;

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

  -- Ownership : owner OU admin/animateur
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

  -- UPDATE avec catch des contraintes CHECK (ex. chk_croyant_religion_coherence)
  BEGIN
    UPDATE public.personnages
    SET
      nom = p_nom,
      gn_completes = p_gn_completes,
      mini_gn_completes = p_mini_gn_completes,
      ouvertures_terrain = p_ouvertures_terrain,
      est_croyant = p_est_croyant,
      religion_id = p_religion_id
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

  v_validation := public.valider_etape_1(p_personnage_id);

  IF NOT (v_validation->>'valide')::boolean THEN
    -- Sauvegarde partielle conservée, pas de transition d'étape
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

  -- Transition vers étape 2 uniquement si on était à l'étape 1 (pas de régression)
  IF v_perso.etape_creation = 1 THEN
    UPDATE public.personnages
    SET etape_creation = 2
    WHERE id = p_personnage_id;
    v_etape_apres := 2;
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
$func$;

COMMENT ON FUNCTION public.sauvegarder_etape_1(uuid, text, integer, integer, integer, boolean, uuid) IS
  'Phase 1.6.1 — Sauvegarde l''étape 1 (InfosBase). UPDATE conservé même si validation échoue (sauvegarde partielle). Transition vers étape 2 uniquement si etape_creation = 1 ET validation OK. Comportement souple : autorise re-sauvegarder l''étape 1 même si etape_creation > 1 sans régression. Codes erreurs : non_authentifie, personnage_introuvable, ownership_refuse, personnage_verrouille, contrainte_violee + erreurs propagées de valider_etape_1.';

GRANT EXECUTE ON FUNCTION public.sauvegarder_etape_1(uuid, text, integer, integer, integer, boolean, uuid) TO authenticated;
