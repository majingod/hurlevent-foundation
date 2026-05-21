-- ============================================================================
-- Phase 5.1 — Règle métier modif post-finalisation (Voie Z)
-- ============================================================================
-- Objectif : permettre à un joueur de modifier son personnage finalisé tant
-- qu'aucun événement n'a confirmé son inscription, sans casser l'override
-- admin (verrouiller_personnage / deverrouiller_personnage).
--
-- Architecture (Voie Z) :
--   * Nouvelle colonne `est_finalise` distingue verrouillage "joueur a finalisé"
--     de verrouillage "admin a manuellement verrouillé".
--   * Fonction utilitaire `personnage_est_modifiable(uuid)` centralise la
--     logique : modifiable si NON verrouillé OU (verrouillé par finalisation
--     ET pas d'inscription confirmée).
--   * "Inscription confirmée" = `inscriptions_evenements.date_confirmation IS
--     NOT NULL` (la colonne statut ne contient pas de valeur 'confirmee').
--   * Tous les RPC de modification (15) consultent cette fonction au lieu de
--     lire `est_verrouille` directement.
--   * Le code d'erreur 'personnage_verrouille' est conservé (compat front).
--
-- Couvre 100% des cas actuels (0 inscription en base). Section 8.2 (verrou
-- granulaire post-événement) reportée à Sprint 5.8.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD COLUMN personnages.est_finalise (idempotent)
-- ----------------------------------------------------------------------------
ALTER TABLE public.personnages
  ADD COLUMN IF NOT EXISTS est_finalise boolean NOT NULL DEFAULT false;

-- ----------------------------------------------------------------------------
-- 2. Backfill : tout perso actuellement verrouillé = considéré finalisé
--    (les seuls verrouillés en base sont issus de valider_personnage_final)
-- ----------------------------------------------------------------------------
UPDATE public.personnages
SET est_finalise = true
WHERE est_verrouille = true
  AND est_finalise = false;

-- ----------------------------------------------------------------------------
-- 3. Fonction utilitaire personnage_est_modifiable(uuid) -> boolean
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.personnage_est_modifiable(p_personnage_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_est_verrouille boolean;
  v_est_finalise   boolean;
  v_a_inscription_confirmee boolean;
BEGIN
  SELECT est_verrouille, est_finalise
    INTO v_est_verrouille, v_est_finalise
  FROM public.personnages
  WHERE id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN false;  -- personnage inexistant => non modifiable
  END IF;

  -- Cas 1 : pas verrouille du tout => modifiable
  IF NOT v_est_verrouille THEN
    RETURN true;
  END IF;

  -- Cas 2 : verrouille MAIS par un admin (pas par finalisation joueur)
  --         => non modifiable
  IF NOT v_est_finalise THEN
    RETURN false;
  END IF;

  -- Cas 3 : verrouille par finalisation joueur. Modifiable si aucune
  -- inscription a un evenement n'a ete confirmee.
  SELECT EXISTS (
    SELECT 1
    FROM public.inscriptions_evenements
    WHERE personnage_id = p_personnage_id
      AND date_confirmation IS NOT NULL
  ) INTO v_a_inscription_confirmee;

  RETURN NOT v_a_inscription_confirmee;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. valider_personnage_final : set aussi est_finalise = true
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valider_personnage_final(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_user_id uuid;
  v_etape integer;
  v_resultat jsonb;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
  v_toutes_valides boolean := true;
BEGIN
  v_user_id := auth.uid();

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF v_perso.joueur_id IS DISTINCT FROM v_user_id
     AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', v_perso.est_verrouille,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','non_autorise','message','Vous n''êtes pas autorisé à finaliser ce personnage')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  IF v_perso.est_verrouille = true THEN
    RETURN jsonb_build_object(
      'valide', false, 'est_verrouille', true,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code','personnage_deja_verrouille','message','Ce personnage est déjà verrouillé')),
      'avertissements', '[]'::jsonb
    );
  END IF;

  FOR v_etape IN 1..11 LOOP
    v_resultat := public.valider_etape(p_personnage_id, v_etape);

    IF (v_resultat->>'valide')::boolean = false THEN
      v_toutes_valides := false;
    END IF;

    v_erreurs := v_erreurs || COALESCE(v_resultat->'erreurs', '[]'::jsonb);
    v_avertissements := v_avertissements || COALESCE(v_resultat->'avertissements', '[]'::jsonb);
  END LOOP;

  IF v_toutes_valides THEN
    UPDATE public.personnages
    SET est_verrouille = true,
        est_finalise   = true,
        etape_creation = 12
    WHERE id = p_personnage_id;

    RETURN jsonb_build_object(
      'valide', true, 'est_verrouille', true,
      'erreurs', '[]'::jsonb, 'avertissements', v_avertissements
    );
  END IF;

  RETURN jsonb_build_object(
    'valide', false, 'est_verrouille', false,
    'erreurs', v_erreurs, 'avertissements', v_avertissements
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 5. Refactor des 15 RPC : remplacement du garde est_verrouille
--    par appel a personnage_est_modifiable(). Code d'erreur conserve
--    ('personnage_verrouille'), message ameliore.
-- ----------------------------------------------------------------------------

-- 5.1 sauvegarder_etape_1
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_1(p_personnage_id uuid, p_nom text, p_gn_completes integer, p_mini_gn_completes integer, p_ouvertures_terrain integer, p_est_croyant boolean, p_religion_id uuid)
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
    SET nom = p_nom,
        gn_completes = p_gn_completes,
        mini_gn_completes = p_mini_gn_completes,
        ouvertures_terrain = p_ouvertures_terrain,
        est_croyant = p_est_croyant,
        religion_id = p_religion_id
    WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;

  v_validation := public.valider_etape_1(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
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

-- 5.2 sauvegarder_etape_2
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
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;
  BEGIN
    UPDATE public.personnages SET race_id = p_race_id, sous_type_chimeride = p_sous_type_chimeride
     WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  SELECT nom INTO v_race_nom FROM public.races WHERE id = p_race_id;
  IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
    SELECT EXISTS (SELECT 1 FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id) INTO v_demande_existante;
    IF NOT v_demande_existante THEN
      IF p_justification IS NULL OR char_length(trim(p_justification)) < 100 THEN
        v_avertissements := v_avertissements || jsonb_build_object(
          'code', 'justification_race_speciale_requise',
          'message', 'Cette race nécessite une demande d''approbation avec une justification d''au moins 100 caractères.');
      ELSE
        v_demande_resultat := public.creer_demande_race(p_personnage_id, p_justification);
        IF NOT COALESCE((v_demande_resultat->>'succes')::boolean, false) THEN
          v_avertissements := v_avertissements || jsonb_build_object(
            'code', 'demande_race_echec',
            'message', COALESCE(v_demande_resultat->>'erreur', 'Création de la demande de race échouée.'));
        END IF;
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

-- 5.3 sauvegarder_etape_3
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_3(p_personnage_id uuid, p_traits_raciaux_choisis jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer;
  v_traits_recalcules jsonb := '[]'::jsonb;
  v_validation jsonb;
  v_etape_apres integer;
  v_trait jsonb;
  v_trait_id uuid;
  v_cout_xp integer;
  v_est_gratuit boolean;
  v_trait_nom text;
  v_index integer := 0;
BEGIN
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.joueur_id <> v_joueur_id AND NOT public.est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END IF;
  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race FROM public.races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);
  BEGIN
    DELETE FROM public.historique_xp
    WHERE personnage_id = p_personnage_id AND type_mouvement = 'depense_trait';
    FOR v_trait IN SELECT value FROM jsonb_array_elements(COALESCE(p_traits_raciaux_choisis, '[]'::jsonb))
    LOOP
      v_trait_id := (v_trait->>'trait_id')::uuid;
      IF v_index < v_nb_traits_gratuits_race THEN
        v_est_gratuit := true;
        v_cout_xp := 0;
      ELSE
        v_est_gratuit := false;
        SELECT cout_xp INTO v_cout_xp FROM public.vue_traits_par_race
         WHERE race_id = v_perso.race_id AND trait_id = v_trait_id LIMIT 1;
        v_cout_xp := COALESCE(v_cout_xp, 0);
      END IF;
      v_traits_recalcules := v_traits_recalcules || jsonb_build_array(jsonb_build_object(
        'trait_id', v_trait_id, 'est_gratuit', v_est_gratuit, 'xp_depense', v_cout_xp));
      IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
        SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
        INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
        VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
                format('Achat trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                v_trait_id, v_joueur_id);
      END IF;
      v_index := v_index + 1;
    END LOOP;
    UPDATE public.personnages SET traits_raciaux_choisis = v_traits_recalcules WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  v_validation := public.valider_etape_3(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;
  IF v_perso.etape_creation = 3 THEN
    UPDATE public.personnages SET etape_creation = 4 WHERE id = p_personnage_id;
    v_etape_apres := 4;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres,
      'traits_raciaux_choisis', v_traits_recalcules));
END;
$function$;

-- 5.4 sauvegarder_etape_4
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_4(p_personnage_id uuid, p_classe_id uuid, p_choix_par_competence jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id    uuid := auth.uid();
  v_perso        public.personnages%ROWTYPE;
  v_validation   jsonb;
  v_attribution  jsonb;
  v_etape_apres  integer;
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

  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object(
        'code', 'personnage_verrouille',
        'message', 'Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).'
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

  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;

  v_attribution := public.attribuer_competences_gratuites_classe(
    p_personnage_id,
    COALESCE(p_choix_par_competence, '{}'::jsonb)
  );

  IF NOT (v_attribution->>'succes')::boolean THEN
    RETURN jsonb_build_object(
      'succes', false,
      'erreurs', v_attribution->'erreurs',
      'avertissements', v_attribution->'avertissements',
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id,
        'etape_creation_apres', v_perso.etape_creation
      )
    );
  END IF;

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

-- 5.5 sauvegarder_etape_10
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_10(p_personnage_id uuid, p_historique text, p_ame_personnage text)
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
    UPDATE public.personnages SET historique = p_historique, ame_personnage = p_ame_personnage WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  v_validation := public.valider_etape_10(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs', 'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;
  IF v_perso.etape_creation = 10 THEN
    UPDATE public.personnages SET etape_creation = 11 WHERE id = p_personnage_id;
    v_etape_apres := 11;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;

-- 5.6 avancer_etape
CREATE OR REPLACE FUNCTION public.avancer_etape(p_personnage_id uuid, p_etape_courante integer)
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

  IF p_etape_courante < 5 OR p_etape_courante > 9 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'etape_invalide',
        'message', 'avancer_etape ne couvre que les etapes 5 a 9.')),
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

  v_validation := public.valider_etape(p_personnage_id, p_etape_courante);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs',
      'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;

  IF v_perso.etape_creation = p_etape_courante THEN
    UPDATE public.personnages SET etape_creation = p_etape_courante + 1 WHERE id = p_personnage_id;
    v_etape_apres := p_etape_courante + 1;
  ELSE
    v_etape_apres := v_perso.etape_creation;
  END IF;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', v_validation->'avertissements',
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;

-- 5.7 acheter_assemblage
CREATE OR REPLACE FUNCTION public.acheter_assemblage(p_personnage_id uuid, p_assemblage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_niveau_runes integer;
  v_quota_total integer;
  v_nb_gratuits integer;
  v_est_gratuit boolean;
  v_cout_xp integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT niveau_runes, quota_assemblages_total INTO v_niveau_runes, v_quota_total
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  IF v_niveau_runes IS NULL OR v_niveau_runes < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Assemblage de Runes requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT COUNT(*)::integer INTO v_nb_gratuits FROM personnage_assemblages
   WHERE personnage_id = p_personnage_id AND est_gratuit = true;
  IF v_nb_gratuits < v_quota_total THEN
    v_est_gratuit := true;
    v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
    SELECT cout_xp INTO v_cout_xp FROM assemblages_runes WHERE id = p_assemblage_id;
    IF v_cout_xp IS NULL THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','assemblage_introuvable','message','Assemblage introuvable ou sans coût défini')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;
  BEGIN
    INSERT INTO personnage_assemblages (personnage_id, assemblage_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_assemblage_id, v_cout_xp, v_est_gratuit)
    RETURNING id INTO v_new_id;
    IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
      UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
       WHERE id = p_personnage_id;
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, assemblage_id, acteur_id)
      VALUES (p_personnage_id, 'depense_assemblage', -v_cout_xp,
              'Achat assemblage de runes (' || v_cout_xp || ' XP)', p_assemblage_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_est_gratuit, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5.8 acheter_competence
CREATE OR REPLACE FUNCTION public.acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text, p_appris_via_maitre boolean DEFAULT false, p_nom_maitre text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_check jsonb;
  v_niveaux jsonb;
  v_cout_xp integer;
  v_xp_disponible integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
  v_statut text;
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
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_check := peut_acheter_competence(p_personnage_id, p_competence_id, p_niveau_desire, p_choix_achat);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT niveaux INTO v_niveaux FROM competences WHERE id = p_competence_id;
  IF v_niveaux IS NULL OR jsonb_array_length(v_niveaux) < p_niveau_desire THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de compétence invalide')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := COALESCE((v_niveaux->(p_niveau_desire - 1)->>'cout_xp')::integer, 0);
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_statut := CASE WHEN p_appris_via_maitre THEN 'en_attente' ELSE 'non_requis' END;
  BEGIN
    INSERT INTO personnage_competences
      (personnage_id, competence_id, niveau_acquis, appris_via_maitre, xp_depense, nom_maitre, statut_maitre, choix_achat)
    VALUES
      (p_personnage_id, p_competence_id, p_niveau_desire, p_appris_via_maitre, v_cout_xp, p_nom_maitre, v_statut, p_choix_achat)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
      VALUES (p_personnage_id, 'depense_competence', -v_cout_xp,
              'Achat compétence niveau ' || p_niveau_desire || ' (' || v_cout_xp || ' XP)',
              p_competence_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_competence_id', v_new_id,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5.9 acheter_objet_forge
CREATE OR REPLACE FUNCTION public.acheter_objet_forge(p_personnage_id uuid, p_objet_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_niveau_forge integer;
  v_difficulte integer;
  v_cout_xp integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT niveau_forge INTO v_niveau_forge FROM vue_artisanat_etat WHERE personnage_id = p_personnage_id;
  SELECT difficulte, cout_xp INTO v_difficulte, v_cout_xp FROM objets_forge WHERE id = p_objet_id;
  IF v_difficulte IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','objet_introuvable','message','Objet de forge introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := COALESCE(v_cout_xp, 0);
  IF COALESCE(v_niveau_forge, 0) < v_difficulte THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint',
        'message','Niveau de Forge insuffisant (requis : ' || v_difficulte || ', actuel : ' || COALESCE(v_niveau_forge, 0) || ')')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  BEGIN
    INSERT INTO personnage_objets_forge (personnage_id, objet_id, xp_depense)
    VALUES (p_personnage_id, p_objet_id, v_cout_xp) RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, objet_forge_id, acteur_id)
      VALUES (p_personnage_id, 'depense_objet_forge', -v_cout_xp, 'Achat objet de forge (' || v_cout_xp || ' XP)', p_objet_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5.10 acheter_objet_joaillerie
CREATE OR REPLACE FUNCTION public.acheter_objet_joaillerie(p_personnage_id uuid, p_objet_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_niveau_joaillerie integer;
  v_difficulte integer;
  v_cout_xp integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT niveau_joaillerie INTO v_niveau_joaillerie FROM vue_artisanat_etat WHERE personnage_id = p_personnage_id;
  SELECT difficulte, cout_xp INTO v_difficulte, v_cout_xp FROM objets_joaillerie WHERE id = p_objet_id;
  IF v_difficulte IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','objet_introuvable','message','Objet de joaillerie introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := COALESCE(v_cout_xp, 0);
  IF COALESCE(v_niveau_joaillerie, 0) < v_difficulte THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint',
        'message','Niveau de Joaillerie insuffisant (requis : ' || v_difficulte || ', actuel : ' || COALESCE(v_niveau_joaillerie, 0) || ')')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  BEGIN
    INSERT INTO personnage_objets_joaillerie (personnage_id, objet_id, xp_depense)
    VALUES (p_personnage_id, p_objet_id, v_cout_xp) RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, objet_joaillerie_id, acteur_id)
      VALUES (p_personnage_id, 'depense_objet_joaillerie', -v_cout_xp, 'Achat objet de joaillerie (' || v_cout_xp || ' XP)', p_objet_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5.11 acheter_priere
CREATE OR REPLACE FUNCTION public.acheter_priere(p_personnage_id uuid, p_priere_id uuid, p_niveau_priere integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_cout_xp integer;
  v_niveau_max integer;
  v_xp_disponible integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT * INTO v_priere FROM prieres WHERE id = p_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','priere_introuvable','message','Prière introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF v_perso.religion_id IS NULL OR v_priere.religion_id IS NULL OR v_perso.religion_id <> v_priere.religion_id THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','croyant_requis','message','La religion du personnage ne correspond pas à celle de la prière')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := CEIL(COALESCE(v_priere.cout_xp_base, 0))::integer;
  SELECT niveau_max_prieres INTO v_niveau_max FROM vue_domaines_disponibles
   WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;
  IF v_niveau_max IS NULL OR p_niveau_priere > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de prière supérieur au maximum autorisé pour ce domaine')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  BEGIN
    INSERT INTO personnage_prieres (personnage_id, priere_id, niveau_priere, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie)
    VALUES (p_personnage_id, p_priere_id, p_niveau_priere, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
      VALUES (p_personnage_id, 'depense_priere', -v_cout_xp, 'Achat prière niveau ' || p_niveau_priere || ' (' || v_cout_xp || ' XP)', p_priere_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_priere_id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5.12 acheter_recette
CREATE OR REPLACE FUNCTION public.acheter_recette(p_personnage_id uuid, p_recette_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_niveau_alchimie integer;
  v_quota_total integer;
  v_nb_gratuits integer;
  v_est_gratuit boolean;
  v_cout_xp integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT niveau_alchimie, quota_recettes_total INTO v_niveau_alchimie, v_quota_total
    FROM vue_artisanat_quotas WHERE personnage_id = p_personnage_id;
  IF v_niveau_alchimie IS NULL OR v_niveau_alchimie < 1 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_requis_non_atteint','message','Compétence Alchimie requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT COUNT(*)::integer INTO v_nb_gratuits FROM personnage_recettes
   WHERE personnage_id = p_personnage_id AND est_gratuit = true;
  IF v_nb_gratuits < v_quota_total THEN
    v_est_gratuit := true;
    v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
    SELECT cout_xp INTO v_cout_xp FROM recettes_alchimie WHERE id = p_recette_id;
    IF v_cout_xp IS NULL THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','recette_introuvable','message','Recette introuvable ou sans coût défini')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;
  BEGIN
    INSERT INTO personnage_recettes (personnage_id, recette_id, xp_depense, est_gratuit)
    VALUES (p_personnage_id, p_recette_id, v_cout_xp, v_est_gratuit)
    RETURNING id INTO v_new_id;
    IF NOT v_est_gratuit AND v_cout_xp > 0 THEN
      UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
       WHERE id = p_personnage_id;
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, recette_id, acteur_id)
      VALUES (p_personnage_id, 'depense_recette', -v_cout_xp,
              'Achat recette d''alchimie (' || v_cout_xp || ' XP)', p_recette_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('id', v_new_id, 'est_gratuit', v_est_gratuit, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5.13 acheter_sort
CREATE OR REPLACE FUNCTION public.acheter_sort(p_personnage_id uuid, p_sort_id uuid, p_niveau_sort integer, p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_nom_personnalise text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_cercle text;
  v_cout_xp_base numeric;
  v_cout_xp integer;
  v_niveau_max integer;
  v_xp_disponible integer;
  v_new_id uuid;
  v_xp_total integer;
  v_xp_depense integer;
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
  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  SELECT cercle, cout_xp_base INTO v_cercle, v_cout_xp_base FROM sorts WHERE id = p_sort_id;
  IF v_cercle IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','sort_introuvable','message','Sort introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_cout_xp := CEIL(COALESCE(v_cout_xp_base, 0))::integer;
  SELECT niveau_max_sorts INTO v_niveau_max FROM vue_cercles_disponibles
   WHERE personnage_id = p_personnage_id AND cercle = v_cercle;
  IF v_niveau_max IS NULL OR p_niveau_sort > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de sort supérieur au maximum autorisé pour ce cercle')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  v_xp_disponible := v_perso.xp_total - v_perso.xp_depense;
  IF v_xp_disponible < v_cout_xp THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;
  BEGIN
    INSERT INTO personnage_sorts (personnage_id, sort_id, niveau_sort, xp_depense, nom_personnalise, zone_choisie, portee_choisie, duree_choisie)
    VALUES (p_personnage_id, p_sort_id, p_niveau_sort, v_cout_xp, p_nom_personnalise, p_zone_choisie, p_portee_choisie, p_duree_choisie)
    RETURNING id INTO v_new_id;
    UPDATE personnages SET xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;
    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
      VALUES (p_personnage_id, 'depense_sort', -v_cout_xp, 'Achat sort niveau ' || p_niveau_sort || ' (' || v_cout_xp || ' XP)', p_sort_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;
  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense FROM personnages WHERE id = p_personnage_id;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_sort_id', v_new_id, 'xp_depense_achat', v_cout_xp,
      'xp_total', v_xp_total, 'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5.14 acheter_trait_racial
CREATE OR REPLACE FUNCTION public.acheter_trait_racial(p_personnage_id uuid, p_trait_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer;
  v_nb_gratuits_acquis integer;
  v_est_gratuit boolean;
  v_cout_xp integer := 0;
  v_check jsonb;
  v_xp_total integer;
  v_xp_depense integer;
  v_traits jsonb;
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

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_check := peut_acheter_trait_racial(p_personnage_id, p_trait_id, v_perso.race_id, v_perso.sous_type_chimeride);
  IF NOT (v_check->>'peut_acheter')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_refuse','message', COALESCE(v_check->>'raison','Achat refusé'))),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race FROM races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);

  SELECT COUNT(*)::integer INTO v_nb_gratuits_acquis
    FROM jsonb_array_elements(COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb)) elem
   WHERE (elem->>'est_gratuit')::boolean = true;

  IF v_nb_gratuits_acquis < v_nb_traits_gratuits_race THEN
    v_est_gratuit := true;
    v_cout_xp := 0;
  ELSE
    v_est_gratuit := false;
    SELECT cout_xp INTO v_cout_xp FROM vue_traits_par_race
     WHERE race_id = v_perso.race_id AND trait_id = p_trait_id LIMIT 1;
    v_cout_xp := COALESCE(v_cout_xp, 0);

    IF (v_perso.xp_total - v_perso.xp_depense) < v_cout_xp THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  BEGIN
    UPDATE personnages
       SET traits_raciaux_choisis = COALESCE(traits_raciaux_choisis, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object(
                'trait_id', p_trait_id, 'est_gratuit', v_est_gratuit, 'xp_depense', v_cout_xp)),
           xp_depense = xp_depense + v_cout_xp, date_modification = now(), updated_at = now()
     WHERE id = p_personnage_id;

    IF v_cout_xp > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
      VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
              'Achat trait racial (' || v_cout_xp || ' XP)', p_trait_id, v_uid);
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense, traits_raciaux_choisis INTO v_xp_total, v_xp_depense, v_traits
    FROM personnages WHERE id = p_personnage_id;

  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('est_gratuit', v_est_gratuit, 'xp_depense_achat', v_cout_xp,
      'traits_raciaux_choisis', v_traits, 'xp_total', v_xp_total,
      'xp_depense', v_xp_depense, 'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

-- 5.15 desacheter_competence
CREATE OR REPLACE FUNCTION public.desacheter_competence(p_personnage_competence_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pc personnage_competences%ROWTYPE;
  v_comp competences%ROWTYPE;
  v_lignes_supprimees jsonb := '[]'::jsonb;
  v_xp_total_rembourse integer := 0;
  v_nb_lignes integer := 0;
  v_ligne RECORD;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
  v_prereq_apres jsonb;
  v_comp_dependante RECORD;
  v_noms_bloquants text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pc FROM personnage_competences WHERE id = p_personnage_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cet achat de compétence n''existe pas')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pc.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_perso.joueur_id <> v_uid AND NOT est_animateur_ou_admin() THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.personnage_est_modifiable(v_pc.personnage_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_verrouille',
        'message','Ce personnage ne peut plus être modifié (verrouillé par l''animation ou inscrit à un événement confirmé).')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF v_pc.xp_depense = 0 THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','competence_gratuite','message','Une compétence acquise gratuitement (de classe) ne peut pas être désachetée')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_comp FROM competences WHERE id = v_pc.competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','competence_introuvable','message','Compétence introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  BEGIN
    IF v_comp.type_achat IN ('simple','unique_avec_choix','multiple_avec_choix_par_niveau') THEN
      FOR v_ligne IN
        SELECT id, niveau_acquis, xp_depense, choix_achat
        FROM personnage_competences
        WHERE personnage_id = v_pc.personnage_id
          AND competence_id = v_pc.competence_id
          AND niveau_acquis >= v_pc.niveau_acquis
        ORDER BY niveau_acquis DESC
      LOOP
        v_lignes_supprimees := v_lignes_supprimees || jsonb_build_object(
          'personnage_competence_id', v_ligne.id,
          'niveau_acquis', v_ligne.niveau_acquis,
          'xp_rembourse', v_ligne.xp_depense,
          'choix_achat', v_ligne.choix_achat
        );
        v_xp_total_rembourse := v_xp_total_rembourse + v_ligne.xp_depense;
        v_nb_lignes := v_nb_lignes + 1;
      END LOOP;

      DELETE FROM personnage_competences
      WHERE personnage_id = v_pc.personnage_id
        AND competence_id = v_pc.competence_id
        AND niveau_acquis >= v_pc.niveau_acquis;
    ELSE
      v_lignes_supprimees := jsonb_build_array(jsonb_build_object(
        'personnage_competence_id', v_pc.id,
        'niveau_acquis', v_pc.niveau_acquis,
        'xp_rembourse', v_pc.xp_depense,
        'choix_achat', v_pc.choix_achat
      ));
      v_xp_total_rembourse := v_pc.xp_depense;
      v_nb_lignes := 1;

      DELETE FROM personnage_competences WHERE id = v_pc.id;
    END IF;

    v_prereq_apres := verifier_prerequis_competences(v_pc.personnage_id);

    FOR v_comp_dependante IN
      SELECT c.id, c.nom, max(pc.niveau_acquis) AS niveau_possede
      FROM personnage_competences pc
      JOIN competences c ON c.id = pc.competence_id
      WHERE pc.personnage_id = v_pc.personnage_id
      GROUP BY c.id, c.nom
    LOOP
      IF v_prereq_apres ? v_comp_dependante.id::text THEN
        IF v_comp_dependante.niveau_possede >
           COALESCE((v_prereq_apres -> v_comp_dependante.id::text ->> 'niveau_max_achetable')::int, 3)
        THEN
          v_noms_bloquants := v_noms_bloquants || v_comp_dependante.nom;
        END IF;
      END IF;
    END LOOP;

    IF array_length(v_noms_bloquants, 1) > 0 THEN
      RAISE EXCEPTION 'DEPENDANCES_PREREQUIS:%', array_to_string(v_noms_bloquants, ', ');
    END IF;

    IF v_xp_total_rembourse > 0 THEN
      INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, competence_id, acteur_id)
      VALUES (
        v_pc.personnage_id,
        'remboursement',
        v_xp_total_rembourse,
        'Annulation achat compétence (' || v_nb_lignes::text || ' niveau(x))',
        v_pc.competence_id,
        v_uid
      );
    END IF;

  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'DEPENDANCES_PREREQUIS:%' THEN
        RETURN jsonb_build_object('succes', false,
          'erreurs', jsonb_build_array(jsonb_build_object(
            'code','dependances_prerequis',
            'message', format(
              'Impossible de désacheter « %s » : les compétences suivantes en dépendent — %s. Désachète-les d''abord.',
              v_comp.nom,
              substring(SQLERRM from 'DEPENDANCES_PREREQUIS:(.*)')
            )
          )),
          'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
      END IF;
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','erreur_suppression','message', SQLERRM)),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pc.personnage_id;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb,
    'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'lignes_supprimees', v_lignes_supprimees,
      'nb_lignes_supprimees', v_nb_lignes,
      'xp_total_rembourse', v_xp_total_rembourse,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres
    ));
END;
$function$;

-- 5.16 peut_acheter_competence (lecture : aligne sur personnage_est_modifiable)
CREATE OR REPLACE FUNCTION public.peut_acheter_competence(p_personnage_id uuid, p_competence_id uuid, p_niveau_desire integer, p_choix_achat text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_personnage          RECORD;
  v_competence          RECORD;
  v_est_propre_classe   boolean;
  v_classe_normalisee   text;
  v_niveau_max_actuel   integer;
  v_niveau_max_autorise integer;
  v_deja_choisi         boolean;
  v_cout_xp             integer;
  v_necessite_maitre    boolean;
  v_prereq              jsonb;
  v_prereq_item         jsonb;
  v_manquants           text[];
  v_niveau_actuel_pre   integer;
  v_nom_lisible         text;
  v_choix_existant      text;
BEGIN
  SELECT p.id, p.classe_id, cl.nom AS classe_nom,
         (COALESCE(p.xp_total,0) - COALESCE(p.xp_depense,0)) AS xp_dispo,
         p.ps_max
    INTO v_personnage
    FROM personnages p
    LEFT JOIN classes cl ON cl.id = p.classe_id
   WHERE p.id = p_personnage_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Personnage introuvable');
  END IF;
  IF NOT public.personnage_est_modifiable(p_personnage_id) THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Personnage verrouillé ou inscrit à un événement confirmé');
  END IF;

  SELECT * INTO v_competence FROM competences WHERE id = p_competence_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence introuvable');
  END IF;
  IF NOT v_competence.est_actif THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Compétence inactive');
  END IF;

  IF v_competence.classes_requises IS NOT NULL AND array_length(v_competence.classes_requises, 1) > 0 THEN
    v_classe_normalisee := CASE v_personnage.classe_nom
      WHEN 'Guerrier' THEN 'guerrier'
      WHEN 'Voleur'   THEN 'voleur'
      WHEN 'Mage'     THEN 'mage'
      WHEN 'Prêtre'   THEN 'pretre'
      ELSE NULL
    END;
    IF v_classe_normalisee IS NULL OR NOT (v_classe_normalisee = ANY(v_competence.classes_requises)) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Classe requise : %s', array_to_string(v_competence.classes_requises, ' ou '))
      );
    END IF;
  END IF;

  v_est_propre_classe := (
    (v_competence.categorie = 'guerrier' AND v_personnage.classe_nom = 'Guerrier') OR
    (v_competence.categorie = 'voleur'   AND v_personnage.classe_nom = 'Voleur')   OR
    (v_competence.categorie = 'mage'     AND v_personnage.classe_nom = 'Mage')     OR
    (v_competence.categorie = 'pretre'   AND v_personnage.classe_nom = 'Prêtre')
  );

  IF v_competence.est_general OR v_est_propre_classe THEN
    v_niveau_max_autorise := 3;
  ELSE
    v_niveau_max_autorise := 2;
  END IF;

  IF p_niveau_desire > v_niveau_max_autorise THEN
    RETURN jsonb_build_object(
      'peut_acheter', false,
      'raison', format('Niveau %s inaccessible hors de votre classe (maximum autorisé : %s)', p_niveau_desire, v_niveau_max_autorise)
    );
  END IF;
  IF p_niveau_desire < 1 OR p_niveau_desire > 3 THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Niveau invalide (1 à 3 attendu)');
  END IF;

  IF v_competence.verrouillage_croise THEN
    IF EXISTS (
      SELECT 1 FROM personnage_competences pc2
        JOIN competences c2 ON c2.id = pc2.competence_id
       WHERE pc2.personnage_id = p_personnage_id
         AND c2.nom = v_competence.nom
         AND c2.id <> v_competence.id
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous avez déjà acquis "%s" dans l''autre catégorie', v_competence.nom)
      );
    END IF;
  END IF;

  SELECT COALESCE(max(niveau_acquis), 0) INTO v_niveau_max_actuel
    FROM personnage_competences
   WHERE personnage_id = p_personnage_id AND competence_id = p_competence_id;

  CASE v_competence.type_achat
    WHEN 'simple' THEN
      IF p_niveau_desire <> v_niveau_max_actuel + 1 THEN
        RETURN jsonb_build_object(
          'peut_acheter', false,
          'raison', format('Vous devez d''abord acquérir le niveau %s', v_niveau_max_actuel + 1)
        );
      END IF;

    WHEN 'unique_avec_choix' THEN
      IF v_niveau_max_actuel >= 1 THEN
        SELECT choix_achat INTO v_choix_existant
          FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
         LIMIT 1;
        v_nom_lisible := CASE
          WHEN v_competence.type_choix = 'religion' AND v_choix_existant IS NOT NULL
            THEN COALESCE((SELECT nom FROM religions WHERE id::text = v_choix_existant), v_choix_existant)
          WHEN v_competence.type_choix IN ('langue', 'langue_ancienne') AND v_choix_existant IS NOT NULL
            THEN COALESCE((SELECT nom FROM langues WHERE id::text = v_choix_existant), v_choix_existant)
          ELSE NULL
        END;
        IF v_nom_lisible IS NOT NULL THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Déjà acquis : %s', v_nom_lisible));
        ELSE
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis');
        END IF;
      END IF;
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
      END IF;

    WHEN 'multiple_avec_choix_par_niveau' THEN
      IF v_competence.nom = 'Connaissances Criminelles' AND p_niveau_desire = 1 THEN
        IF v_niveau_max_actuel >= 1 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Déjà acquis au niveau 1');
        END IF;
      ELSE
        IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
        END IF;
        SELECT EXISTS (
          SELECT 1 FROM personnage_competences
           WHERE personnage_id = p_personnage_id
             AND competence_id = p_competence_id
             AND niveau_acquis = p_niveau_desire
             AND choix_achat = p_choix_achat
        ) INTO v_deja_choisi;
        IF v_deja_choisi THEN
          RETURN jsonb_build_object(
            'peut_acheter', false,
            'raison', format('"%s" est déjà acquis au niveau %s', p_choix_achat, p_niveau_desire)
          );
        END IF;
        IF p_niveau_desire >= 2 THEN
          IF v_competence.nom = 'Connaissances Criminelles' AND p_niveau_desire = 2 THEN
            IF v_niveau_max_actuel < 1 THEN
              RETURN jsonb_build_object(
                'peut_acheter', false,
                'raison', 'Vous devez d''abord acquérir Connaissances Criminelles niveau 1'
              );
            END IF;
          ELSE
            IF NOT EXISTS (
              SELECT 1 FROM personnage_competences
               WHERE personnage_id = p_personnage_id
                 AND competence_id = p_competence_id
                 AND niveau_acquis = p_niveau_desire - 1
                 AND choix_achat = p_choix_achat
            ) THEN
              RETURN jsonb_build_object(
                'peut_acheter', false,
                'raison', format('Vous devez d''abord acquérir "%s" niveau %s pour "%s"', v_competence.nom, p_niveau_desire - 1, p_choix_achat)
              );
            END IF;
          END IF;
        END IF;
      END IF;

    WHEN 'multiple_langue' THEN
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF p_choix_achat IS NULL OR length(trim(p_choix_achat)) = 0 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Un choix est obligatoire');
      END IF;
      SELECT EXISTS (
        SELECT 1 FROM personnage_competences
         WHERE personnage_id = p_personnage_id
           AND competence_id = p_competence_id
           AND choix_achat = p_choix_achat
      ) INTO v_deja_choisi;
      IF v_deja_choisi THEN
        v_nom_lisible := CASE
          WHEN v_competence.type_choix IN ('langue', 'langue_ancienne')
            THEN COALESCE((SELECT nom FROM langues WHERE id::text = p_choix_achat), p_choix_achat)
          WHEN v_competence.type_choix = 'religion'
            THEN COALESCE((SELECT nom FROM religions WHERE id::text = p_choix_achat), p_choix_achat)
          ELSE p_choix_achat
        END;
        RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Vous avez déjà acquis "%s"', v_nom_lisible));
      END IF;

    WHEN 'multiple_sans_choix' THEN
      IF p_niveau_desire <> 1 THEN
        RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Seul le niveau 1 est achetable pour cette compétence');
      END IF;
      IF v_competence.nom = 'Développement Spirituel' THEN
        IF COALESCE(v_personnage.ps_max,0) >= 20 THEN
          RETURN jsonb_build_object(
            'peut_acheter', false,
            'raison', 'Maximum de 20 PS atteint — achetez Développement Spirituel Supérieur'
          );
        END IF;
      ELSIF v_competence.nom = 'Développement Spirituel Supérieur' THEN
        IF COALESCE(v_personnage.ps_max,0) < 20 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Nécessite 20 PS (achetez d''abord Développement Spirituel)');
        END IF;
        IF v_personnage.ps_max >= 30 THEN
          RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Maximum absolu atteint (30 PS)');
        END IF;
      END IF;
  END CASE;

  IF v_competence.nom = 'Dépeçage' AND p_niveau_desire = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id
         AND a_connaissance_creatures_1 = true
         AND a_premiers_soins = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissance des Créatures niveau 1 ET Premiers Soins');
    END IF;
    IF p_choix_achat IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM personnage_competences pc3
        JOIN competences c3 ON c3.id = pc3.competence_id
       WHERE pc3.personnage_id = p_personnage_id
         AND c3.nom = 'Connaissance des Créatures'
         AND pc3.niveau_acquis >= 1
         AND pc3.choix_achat = p_choix_achat
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous devez d''abord avoir Connaissance des Créatures pour la catégorie "%s"', p_choix_achat)
      );
    END IF;
  END IF;

  IF v_competence.nom = 'Dépeçage' AND p_niveau_desire = 2 THEN
    IF NOT EXISTS (
      SELECT 1 FROM vue_personnage_etat
       WHERE personnage_id = p_personnage_id AND a_connaissance_creatures_2 = true
    ) THEN
      RETURN jsonb_build_object('peut_acheter', false, 'raison', 'Prérequis : Connaissance des Créatures niveau 2');
    END IF;
    IF p_choix_achat IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM personnage_competences pc4
        JOIN competences c4 ON c4.id = pc4.competence_id
       WHERE pc4.personnage_id = p_personnage_id
         AND c4.nom = 'Connaissance des Créatures'
         AND pc4.niveau_acquis >= 2
         AND pc4.choix_achat = p_choix_achat
    ) THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Vous devez d''abord avoir Connaissance des Créatures niveau 2 pour "%s"', p_choix_achat)
      );
    END IF;
  END IF;

  v_prereq := v_competence.prerequis_competences -> p_niveau_desire::text;
  IF v_prereq IS NOT NULL AND jsonb_array_length(v_prereq) > 0 THEN
    v_manquants := ARRAY[]::text[];
    FOR v_prereq_item IN SELECT * FROM jsonb_array_elements(v_prereq) LOOP
      SELECT COALESCE(max(pc.niveau_acquis), 0)
        INTO v_niveau_actuel_pre
        FROM personnage_competences pc
        JOIN competences c ON c.id = pc.competence_id
       WHERE pc.personnage_id = p_personnage_id
         AND c.nom = (v_prereq_item->>'competence_nom');
      IF v_niveau_actuel_pre < (v_prereq_item->>'niveau_min')::integer THEN
        v_manquants := v_manquants || format('%s niveau %s',
          v_prereq_item->>'competence_nom',
          v_prereq_item->>'niveau_min'
        );
      END IF;
    END LOOP;
    IF array_length(v_manquants, 1) > 0 THEN
      RETURN jsonb_build_object(
        'peut_acheter', false,
        'raison', format('Prérequis manquant(s) : %s', array_to_string(v_manquants, ', '))
      );
    END IF;
  END IF;

  SELECT (elem->>'cout_xp')::integer INTO v_cout_xp
    FROM jsonb_array_elements(v_competence.niveaux) elem
   WHERE (elem->>'niveau')::integer = p_niveau_desire
   LIMIT 1;

  IF v_cout_xp IS NULL THEN
    RETURN jsonb_build_object('peut_acheter', false, 'raison', format('Niveau %s non défini pour cette compétence', p_niveau_desire));
  END IF;

  IF v_personnage.xp_dispo < v_cout_xp THEN
    RETURN jsonb_build_object(
      'peut_acheter', false,
      'raison', format('XP insuffisant. Requis : %s | Disponible : %s', v_cout_xp, v_personnage.xp_dispo)
    );
  END IF;

  v_necessite_maitre := (
    (v_competence.est_general AND p_niveau_desire = 3) OR
    (v_est_propre_classe       AND p_niveau_desire = 3) OR
    (NOT v_competence.est_general AND NOT v_est_propre_classe AND p_niveau_desire = 2)
  );

  RETURN jsonb_build_object(
    'peut_acheter',        true,
    'raison',              'OK',
    'cout_xp',             v_cout_xp,
    'niveau_actuel',       v_niveau_max_actuel,
    'niveau_desire',       p_niveau_desire,
    'necessite_maitre',    v_necessite_maitre,
    'type_achat',          v_competence.type_achat,
    'type_choix',          v_competence.type_choix,
    'verrouillage_croise', v_competence.verrouillage_croise
  );
END;
$function$;
