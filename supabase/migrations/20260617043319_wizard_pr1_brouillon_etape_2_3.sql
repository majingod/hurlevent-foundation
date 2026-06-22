-- WIZARD-REFONTE-UX PR1 (s214) : flag p_brouillon (persist-au-choix) sur
-- sauvegarder_etape_2 (race) et sauvegarder_etape_3 (traits raciaux).
-- Option B (s214) : FONCTION UNIQUE (pas de surcharge). On DROP l'ancienne
-- signature puis on (re)cree la nouvelle avec p_brouillon DEFAULT false.
-- => zero ambiguite SQL/PostgREST ; le front actuel (signature nue) resout
--    vers l'unique fonction (p_brouillon defaute a false). Idempotent.
-- brouillon=true => persiste les champs SANS valider, SANS avancer etape_creation,
--   SANS effet de bord (e2: pas de demande de race ; e2/e3: pas de log_audit).
--   e3 conserve le diff append-only historique_xp (= la persistance des choix de traits).

-- ============================================================================
-- sauvegarder_etape_2 + p_brouillon
-- ============================================================================
DROP FUNCTION IF EXISTS public.sauvegarder_etape_2(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_2(p_personnage_id uuid, p_race_id uuid, p_sous_type_chimeride text DEFAULT NULL::text, p_justification text DEFAULT NULL::text, p_brouillon boolean DEFAULT false)
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
  v_race_changee boolean;
  v_avertissements jsonb := '[]'::jsonb;
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
  v_race_changee := (v_perso.race_id IS DISTINCT FROM p_race_id);
  BEGIN
    UPDATE public.personnages SET race_id = p_race_id, sous_type_chimeride = p_sous_type_chimeride
     WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'contrainte_violee', 'message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;
  -- Brouillon (persist-au-choix, s214) : race_id/sous_type deja persistes ci-dessus.
  -- On ne touche PAS la demande de race, on ne valide pas, on n'avance pas, on ne logue pas.
  IF p_brouillon THEN
    RETURN jsonb_build_object('succes', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'brouillon', true,
        'etape_creation_apres', v_perso.etape_creation));
  END IF;
  SELECT nom INTO v_race_nom FROM public.races WHERE id = p_race_id;
  -- Demande de race (Option 2, s112) : la demande suit la race courante.
  -- Si la race change, on repart d'une demande fraiche ; si la nouvelle race
  -- n'est pas speciale, on nettoie toute demande devenue obsolete.
  -- p_justification est ignore (compat signature) ; background issu de l historique.
  IF v_race_nom IN ('Chiméride', 'Les Non-Races') THEN
    IF v_race_changee THEN
      DELETE FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id;
    END IF;
    SELECT EXISTS (SELECT 1 FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id) INTO v_demande_existante;
    IF NOT v_demande_existante THEN
      v_demande_resultat := public.creer_demande_race(p_personnage_id, v_perso.historique);
      IF NOT COALESCE((v_demande_resultat->>'succes')::boolean, false) THEN
        v_avertissements := v_avertissements || jsonb_build_object(
          'code', 'demande_race_echec',
          'message', COALESCE(v_demande_resultat->>'erreur', 'Création de la demande de race échouée.'));
      END IF;
    END IF;
  ELSIF v_race_changee THEN
    DELETE FROM public.personnage_races_demandes WHERE personnage_id = p_personnage_id;
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
  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'sauvegarder_etape_2', jsonb_build_object('etape', 2));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', v_avertissements,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;

-- ============================================================================
-- sauvegarder_etape_3 + p_brouillon
-- ============================================================================
DROP FUNCTION IF EXISTS public.sauvegarder_etape_3(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_3(p_personnage_id uuid, p_traits_raciaux_choisis jsonb, p_brouillon boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid := auth.uid();
  v_perso public.personnages%ROWTYPE;
  v_nb_traits_gratuits_race integer;
  v_old_traits jsonb;
  v_new_traits jsonb := '[]'::jsonb;
  v_validation jsonb;
  v_etape_apres integer;
  v_trait jsonb;
  v_old_elem jsonb;
  v_trait_id uuid;
  v_cout_xp integer;
  v_est_gratuit boolean;
  v_trait_nom text;
  v_index integer := 0;
  v_old_xp_depense integer;
  v_new_xp_depense integer;
  v_blocage jsonb;
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

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Ce personnage ne vous appartient pas.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(p_personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN RETURN v_blocage; END IF;

  SELECT nb_traits_raciaux INTO v_nb_traits_gratuits_race FROM public.races WHERE id = v_perso.race_id;
  v_nb_traits_gratuits_race := COALESCE(v_nb_traits_gratuits_race, 0);
  v_old_traits := COALESCE(v_perso.traits_raciaux_choisis, '[]'::jsonb);

  FOR v_trait IN SELECT value FROM jsonb_array_elements(COALESCE(p_traits_raciaux_choisis, '[]'::jsonb))
  LOOP
    v_trait_id := (v_trait->>'trait_id')::uuid;
    IF v_index < v_nb_traits_gratuits_race THEN
      v_est_gratuit := true; v_cout_xp := 0;
    ELSE
      v_est_gratuit := false;
      SELECT cout_xp INTO v_cout_xp FROM public.vue_traits_par_race
       WHERE race_id = v_perso.race_id AND trait_id = v_trait_id LIMIT 1;
      v_cout_xp := COALESCE(v_cout_xp, 0);
    END IF;
    v_new_traits := v_new_traits || jsonb_build_array(jsonb_build_object(
      'trait_id', v_trait_id, 'est_gratuit', v_est_gratuit, 'xp_depense', v_cout_xp));
    v_index := v_index + 1;
  END LOOP;

  BEGIN
    FOR v_old_elem IN SELECT value FROM jsonb_array_elements(v_old_traits)
    LOOP
      v_trait_id := (v_old_elem->>'trait_id')::uuid;
      v_old_xp_depense := COALESCE((v_old_elem->>'xp_depense')::integer, 0);
      v_new_xp_depense := NULL;
      SELECT (elem->>'xp_depense')::integer INTO v_new_xp_depense
        FROM jsonb_array_elements(v_new_traits) elem
        WHERE (elem->>'trait_id')::uuid = v_trait_id LIMIT 1;

      IF v_new_xp_depense IS NULL THEN
        IF v_old_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'remboursement', v_old_xp_depense,
                  format('Remboursement trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      ELSIF v_new_xp_depense <> v_old_xp_depense THEN
        IF v_old_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'remboursement', v_old_xp_depense,
                  format('Remboursement trait racial (reorganisation) : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
        IF v_new_xp_depense > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'depense_trait', -v_new_xp_depense,
                  format('Achat trait racial (reorganisation) : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      END IF;
    END LOOP;

    FOR v_trait IN SELECT value FROM jsonb_array_elements(v_new_traits)
    LOOP
      v_trait_id := (v_trait->>'trait_id')::uuid;
      v_cout_xp := COALESCE((v_trait->>'xp_depense')::integer, 0);
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_old_traits) elem
        WHERE (elem->>'trait_id')::uuid = v_trait_id
      ) THEN
        IF v_cout_xp > 0 THEN
          SELECT nom INTO v_trait_nom FROM public.traits_raciaux WHERE id = v_trait_id;
          INSERT INTO public.historique_xp (personnage_id, type_mouvement, montant, description, trait_id, acteur_id)
          VALUES (p_personnage_id, 'depense_trait', -v_cout_xp,
                  format('Achat trait racial : %s', COALESCE(v_trait_nom, v_trait_id::text)),
                  v_trait_id, v_joueur_id);
        END IF;
      END IF;
    END LOOP;

    UPDATE public.personnages SET traits_raciaux_choisis = v_new_traits WHERE id = p_personnage_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('personnage_id', p_personnage_id));
  END;

  -- Brouillon (persist-au-choix, s214) : le diff append-only + UPDATE traits sont
  -- deja faits ci-dessus (= la persistance reelle des choix). On ne valide pas,
  -- on n'avance pas, on ne logue pas.
  IF p_brouillon THEN
    RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object(
        'personnage_id', p_personnage_id, 'brouillon', true,
        'etape_creation_apres', v_perso.etape_creation,
        'traits_raciaux_choisis', v_new_traits));
  END IF;

  v_validation := public.valider_etape_3(p_personnage_id);
  IF NOT (v_validation->>'valide')::boolean THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', v_validation->'erreurs', 'avertissements', v_validation->'avertissements',
      'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
  END IF;

  IF v_perso.etape_creation = 3 THEN
    UPDATE public.personnages SET etape_creation = 4 WHERE id = p_personnage_id;
    v_etape_apres := 4;
  ELSE v_etape_apres := v_perso.etape_creation; END IF;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'sauvegarder_etape_3', jsonb_build_object('etape', 3));
  END IF;
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_id', p_personnage_id,
      'etape_creation_apres', v_etape_apres,
      'traits_raciaux_choisis', v_new_traits));
END;
$function$;
