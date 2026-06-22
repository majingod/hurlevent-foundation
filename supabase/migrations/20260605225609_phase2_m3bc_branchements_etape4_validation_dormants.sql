-- ============================================================================
-- Branchements M3bc
-- 1) sauvegarder_etape_4 : si la classe CHANGE (deja definie et differente),
--    deleguer a changer_classe_personnage (cascade D1-D6). Sinon comportement
--    initial inchange (set classe + attribuer gratuites).
-- 2) valider_etape_6 / valider_etape_7 : ignorer les dormants (statut='cree')
--    dans la boucle de validation ET le comptage.
-- ============================================================================

-- ---------- 1) sauvegarder_etape_4 ----------
CREATE OR REPLACE FUNCTION public.sauvegarder_etape_4(p_personnage_id uuid, p_classe_id uuid, p_choix_par_competence jsonb DEFAULT NULL::jsonb)
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

  -- M3bc : changement de classe (classe deja definie ET differente) -> cascade D1-D6
  IF v_perso.classe_id IS NOT NULL AND p_classe_id IS DISTINCT FROM v_perso.classe_id THEN
    v_cc := public.changer_classe_personnage(p_personnage_id, p_classe_id, p_choix_par_competence, false);
    IF NOT (v_cc->>'succes')::boolean THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', v_cc->'erreurs', 'avertissements', COALESCE(v_cc->'avertissements','[]'::jsonb),
        'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_perso.etape_creation));
    END IF;
    -- changer_classe_personnage a deja : set classe_id + cascade + gratuites + refunds.
  ELSE
    -- selection initiale ou classe inchangee : comportement existant
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
  RETURN jsonb_build_object('succes', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object('personnage_id', p_personnage_id, 'etape_creation_apres', v_etape_apres));
END;
$function$;

-- ---------- 2) valider_etape_6 (sorts) : ignorer dormants ----------
CREATE OR REPLACE FUNCTION public.valider_etape_6(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_sort RECORD;
  v_niveau_max integer;
  v_nb_cercles integer;
  v_nb_sorts integer;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.personnages WHERE id = p_personnage_id) THEN
    RETURN jsonb_build_object('valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb);
  END IF;
  IF NOT public.personnage_a_des_sorts(p_personnage_id) THEN
    RETURN jsonb_build_object('valide', true, 'ignoree', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb);
  END IF;
  FOR v_sort IN
    SELECT ps.sort_id, ps.niveau_sort, s.cercle, s.nom AS sort_nom
    FROM public.personnage_sorts ps
    JOIN public.sorts s ON s.id = ps.sort_id
    WHERE ps.personnage_id = p_personnage_id
      AND ps.statut = 'achete'
  LOOP
    SELECT niveau_max_sorts INTO v_niveau_max
    FROM public.vue_cercles_disponibles
    WHERE personnage_id = p_personnage_id AND cercle = v_sort.cercle;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object('code','sort_cercle_non_debloque',
        'message', format('Le sort %s appartient au cercle %s, non débloqué', v_sort.sort_nom, v_sort.cercle),
        'champ','personnage_sorts');
    ELSIF v_sort.niveau_sort > v_niveau_max THEN
      v_erreurs := v_erreurs || jsonb_build_object('code','sort_niveau_trop_eleve',
        'message', format('Le sort %s (niveau %s) dépasse le max %s du cercle %s', v_sort.sort_nom, v_sort.niveau_sort, v_niveau_max, v_sort.cercle),
        'champ','personnage_sorts');
    END IF;
  END LOOP;
  SELECT count(*) INTO v_nb_cercles FROM public.vue_cercles_disponibles WHERE personnage_id = p_personnage_id;
  SELECT count(*) INTO v_nb_sorts FROM public.personnage_sorts WHERE personnage_id = p_personnage_id AND statut = 'achete';
  IF v_nb_cercles > 0 AND v_nb_sorts = 0 THEN
    v_avertissements := v_avertissements || jsonb_build_object('code','info_cercle_sans_sort',
      'message','Vous avez débloqué un ou plusieurs cercles mais n''avez acheté aucun sort');
  END IF;
  RETURN jsonb_build_object('valide', jsonb_array_length(v_erreurs) = 0, 'ignoree', false,
    'erreurs', v_erreurs, 'avertissements', v_avertissements);
END;
$function$;

-- ---------- 3) valider_etape_7 (prieres) : ignorer dormants ----------
CREATE OR REPLACE FUNCTION public.valider_etape_7(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_perso public.personnages%ROWTYPE;
  v_priere RECORD;
  v_niveau_max integer;
  v_nb_domaines integer;
  v_nb_prieres integer;
  v_erreurs jsonb := '[]'::jsonb;
  v_avertissements jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_perso FROM public.personnages WHERE id = p_personnage_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valide', false, 'ignoree', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb);
  END IF;
  IF NOT public.personnage_a_des_prieres(p_personnage_id) THEN
    RETURN jsonb_build_object('valide', true, 'ignoree', true, 'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb);
  END IF;
  FOR v_priere IN
    SELECT pp.priere_id, pp.niveau_priere, pr.domaine, pr.nom AS priere_nom
    FROM public.personnage_prieres pp
    JOIN public.prieres pr ON pr.id = pp.priere_id
    WHERE pp.personnage_id = p_personnage_id
      AND pp.statut = 'achete'
  LOOP
    SELECT niveau_max_prieres INTO v_niveau_max
    FROM public.vue_domaines_disponibles
    WHERE personnage_id = p_personnage_id AND domaine = v_priere.domaine;
    IF NOT FOUND THEN
      v_erreurs := v_erreurs || jsonb_build_object('code','priere_domaine_non_debloque',
        'message', format('La prière %s appartient au domaine %s, non débloqué', v_priere.priere_nom, v_priere.domaine),
        'champ','personnage_prieres');
    ELSIF v_priere.niveau_priere > v_niveau_max THEN
      v_erreurs := v_erreurs || jsonb_build_object('code','priere_niveau_trop_eleve',
        'message', format('La prière %s (niveau %s) dépasse le max %s du domaine %s', v_priere.priere_nom, v_priere.niveau_priere, v_niveau_max, v_priere.domaine),
        'champ','personnage_prieres');
    END IF;
  END LOOP;
  SELECT count(*) INTO v_nb_domaines FROM public.vue_domaines_disponibles WHERE personnage_id = p_personnage_id;
  SELECT count(*) INTO v_nb_prieres FROM public.personnage_prieres WHERE personnage_id = p_personnage_id AND statut = 'achete';
  IF v_nb_domaines > 0 AND v_nb_prieres = 0 THEN
    v_avertissements := v_avertissements || jsonb_build_object('code','info_domaine_sans_priere',
      'message','Vous avez débloqué un ou plusieurs domaines mais n''avez acheté aucune prière');
  END IF;
  RETURN jsonb_build_object('valide', jsonb_array_length(v_erreurs) = 0, 'ignoree', false,
    'erreurs', v_erreurs, 'avertissements', v_avertissements);
END;
$function$;
