-- PR-1 (s157) — INV3-INSTANCE-SORT-PRIERE
-- 1) capturer_compo_personnage : ajoute instance_id (personnage_sorts.id /
--    personnage_prieres.id) dans sorts[] et prieres[] de la photo.
-- 2) desacheter_sort / desacheter_priere : INV-3 matche par instance_id quand
--    l'entrée photo le contient ; repli conservateur par sort_id/priere_id
--    pour les photos antérieures (immuables, auto-guéri à la photo suivante).

CREATE OR REPLACE FUNCTION public.capturer_compo_personnage(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_compo jsonb;
BEGIN
  SELECT jsonb_build_object(
    'meta', (
      SELECT jsonb_build_object(
        'niveau', pe.niveau,
        'xp_total', pe.xp_total,
        'xp_depense', pe.xp_depense
      )
      FROM public.personnages pe WHERE pe.id = p_personnage_id
    ),
    'competences', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.competence_id,
        'nom', t.nom,
        'choix', t.choix_achat,
        'niveau', t.niveau_max,
        'niveaux', t.niveaux,
        'xp', t.xp_total
      ) ORDER BY t.nom, t.choix_achat)
      FROM (
        SELECT pc.competence_id, c.nom, pc.choix_achat,
               max(pc.niveau_acquis) AS niveau_max,
               jsonb_agg(pc.niveau_acquis ORDER BY pc.niveau_acquis) AS niveaux,
               SUM(pc.xp_depense)::int AS xp_total
        FROM public.personnage_competences pc
        JOIN public.competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p_personnage_id
        GROUP BY pc.competence_id, c.nom, pc.choix_achat
      ) t
    ), '[]'::jsonb),
    'sorts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ps.sort_id,
        'instance_id', ps.id,
        'nom', s.nom,
        'nom_personnalise', ps.nom_personnalise,
        'niveau', ps.niveau_sort,
        'zone', ps.zone_choisie,
        'portee', ps.portee_choisie,
        'duree', ps.duree_choisie,
        'statut', ps.statut,
        'xp', ps.xp_depense
      ) ORDER BY s.nom)
      FROM public.personnage_sorts ps
      JOIN public.sorts s ON s.id = ps.sort_id
      WHERE ps.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'prieres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pp.priere_id,
        'instance_id', pp.id,
        'nom', pr.nom,
        'nom_personnalise', pp.nom_personnalise,
        'niveau', pp.niveau_priere,
        'zone', pp.zone_choisie,
        'portee', pp.portee_choisie,
        'duree', pp.duree_choisie,
        'statut', pp.statut,
        'xp', pp.xp_depense
      ) ORDER BY pr.nom)
      FROM public.personnage_prieres pp
      JOIN public.prieres pr ON pr.id = pp.priere_id
      WHERE pp.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'pieges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.piege_id,
        'nom', t.piege_nom,
        'niveau', t.niveau_max,
        'niveaux', t.niveaux,
        'xp', t.xp_total
      ) ORDER BY t.piege_nom)
      FROM (
        SELECT (array_agg(pg.piege_id))[1] AS piege_id, pg.piege_nom,
               max(pg.niveau_acquis) AS niveau_max,
               jsonb_agg(pg.niveau_acquis ORDER BY pg.niveau_acquis) AS niveaux,
               SUM(pg.xp_depense)::int AS xp_total
        FROM public.personnage_pieges pg
        WHERE pg.personnage_id = p_personnage_id
        GROUP BY pg.piege_nom
      ) t
    ), '[]'::jsonb),
    'recettes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pr2.recette_id, 'nom', ra.nom, 'xp', pr2.xp_depense
      ) ORDER BY ra.nom)
      FROM public.personnage_recettes pr2
      JOIN public.recettes_alchimie ra ON ra.id = pr2.recette_id
      WHERE pr2.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'assemblages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pa.assemblage_id, 'nom', ar.nom, 'xp', pa.xp_depense
      ) ORDER BY ar.nom)
      FROM public.personnage_assemblages pa
      JOIN public.assemblages_runes ar ON ar.id = pa.assemblage_id
      WHERE pa.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'objets_forge', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pof.objet_id, 'nom', oof.nom, 'xp', pof.xp_depense
      ) ORDER BY oof.nom)
      FROM public.personnage_objets_forge pof
      JOIN public.objets_forge oof ON oof.id = pof.objet_id
      WHERE pof.personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'objets_joaillerie', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', poj.objet_id, 'nom', ooj.nom, 'xp', poj.xp_depense
      ) ORDER BY ooj.nom)
      FROM public.personnage_objets_joaillerie poj
      JOIN public.objets_joaillerie ooj ON ooj.id = poj.objet_id
      WHERE poj.personnage_id = p_personnage_id
    ), '[]'::jsonb)
  ) INTO v_compo;

  RETURN v_compo;
END;
$function$;

CREATE OR REPLACE FUNCTION public.desacheter_sort(p_personnage_sort_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_ps personnage_sorts%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
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

  -- INV-1/INV-3 : en campagne, seul un sort hors de la dernière photo est annulable.
  -- Match par instance (entrées photo avec instance_id) ; repli conservateur par
  -- sort de base pour les photos antérieures au format instance_id.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_ps.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'sorts','[]'::jsonb)) e
      WHERE CASE
        WHEN e.value ? 'instance_id'
          THEN (e.value->>'instance_id')::uuid = p_personnage_sort_id
        ELSE (e.value->>'id')::uuid = v_ps.sort_id
      END
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Ce sort fait partie des acquis du personnage (dernière présence confirmée) — il ne peut pas être annulé en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  DELETE FROM personnage_sorts WHERE id = p_personnage_sort_id;

  IF v_ps.xp_depense > 0 THEN
    UPDATE personnages
    SET xp_depense = xp_depense - v_ps.xp_depense,
        date_modification = now(),
        updated_at = now()
    WHERE id = v_ps.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, sort_id, acteur_id)
    VALUES (v_ps.personnage_id, 'remboursement', v_ps.xp_depense,
      'Remboursement sort (' || v_ps.xp_depense || ' XP)', v_ps.sort_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_ps.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_sort', jsonb_build_object('personnage_sort_id', p_personnage_sort_id, 'nom', (SELECT nom FROM sorts WHERE id = v_ps.sort_id), 'niveau', v_ps.niveau_sort, 'xp_rembourse', v_ps.xp_depense));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_sort_id', p_personnage_sort_id,
      'sort_id', v_ps.sort_id,
      'xp_rembourse', v_ps.xp_depense,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;

CREATE OR REPLACE FUNCTION public.desacheter_priere(p_personnage_priere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blocage jsonb;
  v_campagne boolean := false;
  v_photo jsonb;
  v_uid uuid := auth.uid();
  v_perso personnages%ROWTYPE;
  v_pp personnage_prieres%ROWTYPE;
  v_xp_total_apres integer;
  v_xp_depense_apres integer;
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

  -- INV-1/INV-3 : match par instance ; repli conservateur par prière de base
  -- pour les photos antérieures au format instance_id.
  IF v_campagne THEN
    v_photo := public.derniere_photo_compo(v_pp.personnage_id);
    IF v_photo IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(v_photo->'prieres','[]'::jsonb)) e
      WHERE CASE
        WHEN e.value ? 'instance_id'
          THEN (e.value->>'instance_id')::uuid = p_personnage_priere_id
        ELSE (e.value->>'id')::uuid = v_pp.priere_id
      END
    ) THEN
      RETURN jsonb_build_object('succes', false,
        'erreurs', jsonb_build_array(jsonb_build_object('code','acquis_intouchable','message','Cette prière fait partie des acquis du personnage (dernière présence confirmée) — elle ne peut pas être annulée en campagne.')),
        'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
    END IF;
  END IF;

  DELETE FROM personnage_prieres WHERE id = p_personnage_priere_id;

  IF v_pp.xp_depense > 0 THEN
    UPDATE personnages
    SET xp_depense = xp_depense - v_pp.xp_depense,
        date_modification = now(),
        updated_at = now()
    WHERE id = v_pp.personnage_id;

    INSERT INTO historique_xp (personnage_id, type_mouvement, montant, description, priere_id, acteur_id)
    VALUES (v_pp.personnage_id, 'remboursement', v_pp.xp_depense,
      'Remboursement prière (' || v_pp.xp_depense || ' XP)', v_pp.priere_id, v_uid);
  END IF;

  SELECT xp_total, xp_depense INTO v_xp_total_apres, v_xp_depense_apres
  FROM personnages WHERE id = v_pp.personnage_id;

  IF public.doit_logger_action(v_perso.joueur_id) THEN
    PERFORM public.log_audit('personnage', v_perso.id, 'desacheter_priere', jsonb_build_object('personnage_priere_id', p_personnage_priere_id, 'nom', (SELECT nom FROM prieres WHERE id = v_pp.priere_id), 'niveau', v_pp.niveau_priere, 'xp_rembourse', v_pp.xp_depense));
  END IF;
  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'personnage_priere_id', p_personnage_priere_id,
      'priere_id', v_pp.priere_id,
      'xp_rembourse', v_pp.xp_depense,
      'xp_total', v_xp_total_apres,
      'xp_depense', v_xp_depense_apres,
      'xp_restant', v_xp_total_apres - v_xp_depense_apres));
END;
$function$;
