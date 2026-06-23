-- PR-2 (s157) — modifier_sort / modifier_priere (upgrade-en-place, plancher photo)
-- Décisions Fred s157 :
--   * Coût = différence (Option A) entre nouveau coût et XP déjà payés sur l'instance.
--   * Plancher = la photo (Option B) : en campagne, une instance scellée peut être
--     modifiée librement dans la fenêtre courante, jamais sous ses valeurs photo.
--   * Avant la 1re photo (brouillon, remodelage_libre, instance hors photo) :
--     modification libre dans les deux sens, XP ajustés par différence signée.
-- Helpers cout_pts_* extraits comme source unique des coûts Pts par variable
-- (calculer_cout_xp_magie refactorée dessus, comportement identique).

CREATE OR REPLACE FUNCTION public.cout_pts_zone(p_zone text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE p_zone
    WHEN 'Personnelle'    THEN 1
    WHEN '1 Cible'        THEN 2
    WHEN '2 Cibles'       THEN 4
    WHEN '3 Cibles'       THEN 6
    WHEN '4 Cibles'       THEN 8
    WHEN '5 Cibles'       THEN 10
    WHEN 'Rayon 3 pieds'  THEN 6
    WHEN 'Rayon 6 pieds'  THEN 8
    WHEN 'Rayon 10 pieds' THEN 10
    WHEN 'Rayon 25 pieds' THEN 14
    WHEN 'Rayon 50 pieds' THEN 18
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.cout_pts_portee(p_portee text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE p_portee
    WHEN 'Toucher'  THEN 0
    WHEN '5 Pieds'  THEN 1
    WHEN '10 Pieds' THEN 2
    WHEN '25 Pieds' THEN 4
    WHEN '50 Pieds' THEN 8
    WHEN 'À vue'    THEN 10
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.cout_pts_duree(p_duree text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE p_duree
    WHEN 'Instantanée' THEN 1
    WHEN '1 Minute'    THEN 2
    WHEN '5 Minutes'   THEN 3
    WHEN '10 Minutes'  THEN 4
    WHEN '20 Minutes'  THEN 5
    WHEN '30 Minutes'  THEN 6
    WHEN '40 Minutes'  THEN 7
    WHEN '50 Minutes'  THEN 8
    WHEN '60 Minutes'  THEN 9
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.calculer_cout_xp_magie(p_zone_choisie text, p_portee_choisie text, p_duree_choisie text, p_niveau integer, p_cout_xp_base numeric)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RETURN CEIL((public.cout_pts_zone(p_zone_choisie)
             + public.cout_pts_portee(p_portee_choisie)
             + public.cout_pts_duree(p_duree_choisie)
             + p_niveau) * COALESCE(p_cout_xp_base, 0))::integer;
END;
$function$;

CREATE OR REPLACE FUNCTION public.modifier_sort(
  p_personnage_sort_id uuid,
  p_niveau_sort integer,
  p_zone_choisie text,
  p_portee_choisie text,
  p_duree_choisie text,
  p_nom_personnalise text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_entry jsonb;
  v_floor jsonb := NULL;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_ps personnage_sorts%ROWTYPE;
  v_sort sorts%ROWTYPE;
  v_niveau_max integer;
  v_cout_nouveau integer;
  v_diff integer;
  v_formule text;
  v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_ps FROM personnage_sorts WHERE id = p_personnage_sort_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Ce sort n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_ps.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_ps.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_ps.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  -- Plancher (campagne) : la photo fige les valeurs minimales de CETTE instance.
  -- Instance absente de la photo = ajout de la fenêtre courante → modification libre.
  -- Photo ancien format (sans instance_id) : repli conservateur = valeurs actuelles
  -- (montée seule), auto-guéri à la photo suivante.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_ps.personnage_id);
    IF v_photo IS NULL THEN
      v_floor := jsonb_build_object('niveau', v_ps.niveau_sort, 'zone', v_ps.zone_choisie,
                                    'portee', v_ps.portee_choisie, 'duree', v_ps.duree_choisie);
    ELSE
      SELECT e.value INTO v_entry
      FROM jsonb_array_elements(COALESCE(v_photo->'sorts','[]'::jsonb)) e
      WHERE e.value ? 'instance_id'
        AND (e.value->>'instance_id')::uuid = p_personnage_sort_id;
      IF v_entry IS NOT NULL THEN
        v_floor := jsonb_build_object('niveau', (v_entry->>'niveau')::int, 'zone', v_entry->>'zone',
                                      'portee', v_entry->>'portee', 'duree', v_entry->>'duree');
      ELSIF EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'sorts','[]'::jsonb)) e
        WHERE NOT (e.value ? 'instance_id') AND (e.value->>'id')::uuid = v_ps.sort_id
      ) THEN
        v_floor := jsonb_build_object('niveau', v_ps.niveau_sort, 'zone', v_ps.zone_choisie,
                                      'portee', v_ps.portee_choisie, 'duree', v_ps.duree_choisie);
      END IF;
    END IF;
  END IF;

  IF v_floor IS NOT NULL THEN
    IF p_niveau_sort < (v_floor->>'niveau')::int
       OR public.cout_pts_zone(p_zone_choisie) < public.cout_pts_zone(v_floor->>'zone')
       OR public.cout_pts_portee(p_portee_choisie) < public.cout_pts_portee(v_floor->>'portee')
       OR public.cout_pts_duree(p_duree_choisie) < public.cout_pts_duree(v_floor->>'duree') THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_regression','message','Ce sort fait partie des acquis du personnage : son niveau et ses variables ne peuvent pas descendre sous la dernière présence confirmée.')),
        'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('plancher', v_floor));
    END IF;
  END IF;

  SELECT * INTO v_sort FROM sorts WHERE id = v_ps.sort_id;

  SELECT niveau_max_sorts INTO v_niveau_max FROM vue_cercles_disponibles
   WHERE personnage_id = v_ps.personnage_id AND cercle = v_sort.cercle;
  IF v_niveau_max IS NULL OR p_niveau_sort > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de sort superieur au maximum autorise pour ce cercle')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_cout_nouveau := public.calculer_cout_xp_magie(
    p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort, v_sort.cout_xp_base);
  v_diff := v_cout_nouveau - v_ps.xp_depense;

  IF v_diff > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_diff THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_formule := public.generer_formule_magique(
    v_sort.cercle, p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_sort);

  BEGIN
    UPDATE personnage_sorts
    SET niveau_sort = p_niveau_sort,
        zone_choisie = p_zone_choisie,
        portee_choisie = p_portee_choisie,
        duree_choisie = p_duree_choisie,
        xp_depense = v_cout_nouveau,
        nom_personnalise = COALESCE(p_nom_personnalise, nom_personnalise),
        formule_magique = v_formule
    WHERE id = p_personnage_sort_id;

    IF v_diff <> 0 THEN
      UPDATE personnages
      SET xp_depense = xp_depense + v_diff, date_modification = now(), updated_at = now()
      WHERE id = v_ps.personnage_id;

      IF v_diff > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
        VALUES (v_ps.personnage_id, 'depense_sort', -v_diff,
          'Modification sort niveau ' || p_niveau_sort || ' (' || v_diff || ' XP)', v_ps.sort_id, v_uid);
      ELSE
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
        VALUES (v_ps.personnage_id, 'remboursement', -v_diff,
          'Modification sort niveau ' || p_niveau_sort || ' (remboursement ' || (-v_diff) || ' XP)', v_ps.sort_id, v_uid);
      END IF;
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
  FROM personnages WHERE id = v_ps.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'modifier_sort', jsonb_build_object(
      'personnage_sort_id', p_personnage_sort_id,
      'nom', v_sort.nom,
      'avant', jsonb_build_object('niveau', v_ps.niveau_sort, 'zone', v_ps.zone_choisie, 'portee', v_ps.portee_choisie, 'duree', v_ps.duree_choisie, 'xp', v_ps.xp_depense),
      'apres', jsonb_build_object('niveau', p_niveau_sort, 'zone', p_zone_choisie, 'portee', p_portee_choisie, 'duree', p_duree_choisie, 'xp', v_cout_nouveau),
      'xp_diff', v_diff));
  END IF;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_sort_id', p_personnage_sort_id,
      'cout_avant', v_ps.xp_depense,
      'cout_apres', v_cout_nouveau,
      'xp_diff', v_diff,
      'formule_magique', v_formule,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;

CREATE OR REPLACE FUNCTION public.modifier_priere(
  p_personnage_priere_id uuid,
  p_niveau_priere integer,
  p_zone_choisie text,
  p_portee_choisie text,
  p_duree_choisie text,
  p_nom_personnalise text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_entry jsonb;
  v_floor jsonb := NULL;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pp personnage_prieres%ROWTYPE;
  v_priere prieres%ROWTYPE;
  v_niveau_max integer;
  v_cout_nouveau integer;
  v_diff integer;
  v_duree_inc integer;
  v_xp_total integer; v_xp_depense integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','non_authentifie','message','Authentification requise')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_pp FROM personnage_prieres WHERE id = p_personnage_priere_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','achat_introuvable','message','Cette prière n''existe pas dans le personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT * INTO v_perso FROM personnages WHERE id = v_pp.personnage_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','personnage_introuvable','message','Personnage introuvable')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT public.peut_editer_personnage(v_perso.joueur_id) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','ownership_refuse','message','Accès refusé à ce personnage')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_blocage := public.gate_edition_personnage(v_pp.personnage_id, 'complet');
  IF v_blocage IS NOT NULL THEN
    IF (public.etat_edition_personnage(v_pp.personnage_id)->>'etat') = 'campagne' THEN
      v_campagne := true;
    ELSE
      RETURN v_blocage;
    END IF;
  END IF;

  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pp.personnage_id);
    IF v_photo IS NULL THEN
      v_floor := jsonb_build_object('niveau', v_pp.niveau_priere, 'zone', v_pp.zone_choisie,
                                    'portee', v_pp.portee_choisie, 'duree', v_pp.duree_choisie);
    ELSE
      SELECT e.value INTO v_entry
      FROM jsonb_array_elements(COALESCE(v_photo->'prieres','[]'::jsonb)) e
      WHERE e.value ? 'instance_id'
        AND (e.value->>'instance_id')::uuid = p_personnage_priere_id;
      IF v_entry IS NOT NULL THEN
        v_floor := jsonb_build_object('niveau', (v_entry->>'niveau')::int, 'zone', v_entry->>'zone',
                                      'portee', v_entry->>'portee', 'duree', v_entry->>'duree');
      ELSIF EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'prieres','[]'::jsonb)) e
        WHERE NOT (e.value ? 'instance_id') AND (e.value->>'id')::uuid = v_pp.priere_id
      ) THEN
        v_floor := jsonb_build_object('niveau', v_pp.niveau_priere, 'zone', v_pp.zone_choisie,
                                      'portee', v_pp.portee_choisie, 'duree', v_pp.duree_choisie);
      END IF;
    END IF;
  END IF;

  IF v_floor IS NOT NULL THEN
    IF p_niveau_priere < (v_floor->>'niveau')::int
       OR public.cout_pts_zone(p_zone_choisie) < public.cout_pts_zone(v_floor->>'zone')
       OR public.cout_pts_portee(p_portee_choisie) < public.cout_pts_portee(v_floor->>'portee')
       OR public.cout_pts_duree(p_duree_choisie) < public.cout_pts_duree(v_floor->>'duree') THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_regression','message','Cette prière fait partie des acquis du personnage : son niveau et ses variables ne peuvent pas descendre sous la dernière présence confirmée.')),
        'avertissements', '[]'::jsonb, 'donnees', jsonb_build_object('plancher', v_floor));
    END IF;
  END IF;

  SELECT * INTO v_priere FROM prieres WHERE id = v_pp.priere_id;

  SELECT niveau_max_prieres INTO v_niveau_max FROM vue_domaines_disponibles
   WHERE personnage_id = v_pp.personnage_id AND domaine = v_priere.domaine;
  IF v_niveau_max IS NULL OR p_niveau_priere > v_niveau_max THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','niveau_invalide','message','Niveau de prière supérieur au maximum autorisé pour ce domaine')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_cout_nouveau := public.calculer_cout_xp_magie(
    p_zone_choisie, p_portee_choisie, p_duree_choisie, p_niveau_priere, v_priere.cout_xp_base);
  v_diff := v_cout_nouveau - v_pp.xp_depense;

  IF v_diff > 0 AND (v_perso.xp_total - v_perso.xp_depense) < v_diff THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','xp_insuffisant','message','XP insuffisant')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  v_duree_inc := public.calculer_duree_incantation_priere(
    p_portee_choisie, p_zone_choisie, p_duree_choisie, p_niveau_priere);

  BEGIN
    UPDATE personnage_prieres
    SET niveau_priere = p_niveau_priere,
        zone_choisie = p_zone_choisie,
        portee_choisie = p_portee_choisie,
        duree_choisie = p_duree_choisie,
        xp_depense = v_cout_nouveau,
        nom_personnalise = COALESCE(p_nom_personnalise, nom_personnalise),
        duree_incantation_calculee = v_duree_inc
    WHERE id = p_personnage_priere_id;

    IF v_diff <> 0 THEN
      UPDATE personnages
      SET xp_depense = xp_depense + v_diff, date_modification = now(), updated_at = now()
      WHERE id = v_pp.personnage_id;

      IF v_diff > 0 THEN
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
        VALUES (v_pp.personnage_id, 'depense_priere', -v_diff,
          'Modification prière niveau ' || p_niveau_priere || ' (' || v_diff || ' XP)', v_pp.priere_id, v_uid);
      ELSE
        INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
        VALUES (v_pp.personnage_id, 'remboursement', -v_diff,
          'Modification prière niveau ' || p_niveau_priere || ' (remboursement ' || (-v_diff) || ' XP)', v_pp.priere_id, v_uid);
      END IF;
    END IF;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code','contrainte_violee','message', SQLERRM)),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END;

  SELECT xp_total, xp_depense INTO v_xp_total, v_xp_depense
  FROM personnages WHERE id = v_pp.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'modifier_priere', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'nom', v_priere.nom,
      'avant', jsonb_build_object('niveau', v_pp.niveau_priere, 'zone', v_pp.zone_choisie, 'portee', v_pp.portee_choisie, 'duree', v_pp.duree_choisie, 'xp', v_pp.xp_depense),
      'apres', jsonb_build_object('niveau', p_niveau_priere, 'zone', p_zone_choisie, 'portee', p_portee_choisie, 'duree', p_duree_choisie, 'xp', v_cout_nouveau),
      'xp_diff', v_diff));
  END IF;

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'cout_avant', v_pp.xp_depense,
      'cout_apres', v_cout_nouveau,
      'xp_diff', v_diff,
      'duree_incantation_calculee', v_duree_inc,
      'xp_total', v_xp_total,
      'xp_depense', v_xp_depense,
      'xp_restant', v_xp_total - v_xp_depense));
END;
$function$;
