-- M3a-campagne PR-A (1/2) — Fondation frontière photo
-- 1) capturer_compo_personnage : format normalisé (1 entrée par identité)
--    - compétences : identité (competence_id, choix_achat) ; niveau = max ; niveaux[] détail ; xp = somme
--    - pièges      : identité piege_nom ; niveau = max ; niveaux[] ; xp = somme
--    (corrige le bug latent diff multi-niveaux/multi-choix — 0 photo en prod, format libre)
-- 2) diff_compo_photos : match compétences par (id, choix), pièges par nom ; expose 'choix'
-- 3) derniere_photo_compo : helper frontière (NULL si aucune photo)

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

CREATE OR REPLACE FUNCTION public.diff_compo_photos(p_avant jsonb, p_apres jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lignes jsonb := '[]'::jsonb;
  v_cat text;
  v_item jsonb;
  v_match jsonb;
  v_changements jsonb;
  v_champ text;
BEGIN
  -- Compétences : identité = (id, choix) ; niveau simple
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_apres->'competences', '[]'::jsonb)) LOOP
    SELECT e.value INTO v_match
      FROM jsonb_array_elements(COALESCE(p_avant->'competences', '[]'::jsonb)) e
     WHERE e.value->>'id' = v_item->>'id'
       AND (e.value->>'choix') IS NOT DISTINCT FROM (v_item->>'choix')
     LIMIT 1;
    IF v_match IS NULL THEN
      v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
        'categorie', 'competences', 'type', 'ajout',
        'id', v_item->>'id', 'nom', v_item->>'nom', 'choix', v_item->'choix',
        'niveau_apres', v_item->'niveau',
        'xp_delta', -COALESCE((v_item->>'xp')::int, 0)));
    ELSIF COALESCE((v_match->>'niveau')::int, 0) <> COALESCE((v_item->>'niveau')::int, 0) THEN
      v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
        'categorie', 'competences', 'type', 'niveau',
        'id', v_item->>'id', 'nom', v_item->>'nom', 'choix', v_item->'choix',
        'niveau_avant', v_match->'niveau', 'niveau_apres', v_item->'niveau',
        'xp_delta', COALESCE((v_match->>'xp')::int, 0) - COALESCE((v_item->>'xp')::int, 0)));
    END IF;
  END LOOP;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_avant->'competences', '[]'::jsonb)) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_apres->'competences', '[]'::jsonb)) e
       WHERE e.value->>'id' = v_item->>'id'
         AND (e.value->>'choix') IS NOT DISTINCT FROM (v_item->>'choix')
    ) THEN
      v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
        'categorie', 'competences', 'type', 'retrait',
        'id', v_item->>'id', 'nom', v_item->>'nom', 'choix', v_item->'choix',
        'niveau_avant', v_item->'niveau',
        'xp_delta', COALESCE((v_item->>'xp')::int, 0)));
    END IF;
  END LOOP;

  -- Pièges : identité = nom ; niveau simple
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_apres->'pieges', '[]'::jsonb)) LOOP
    SELECT e.value INTO v_match
      FROM jsonb_array_elements(COALESCE(p_avant->'pieges', '[]'::jsonb)) e
     WHERE e.value->>'nom' = v_item->>'nom' LIMIT 1;
    IF v_match IS NULL THEN
      v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
        'categorie', 'pieges', 'type', 'ajout',
        'id', v_item->>'id', 'nom', v_item->>'nom',
        'niveau_apres', v_item->'niveau',
        'xp_delta', -COALESCE((v_item->>'xp')::int, 0)));
    ELSIF COALESCE((v_match->>'niveau')::int, 0) <> COALESCE((v_item->>'niveau')::int, 0) THEN
      v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
        'categorie', 'pieges', 'type', 'niveau',
        'id', v_item->>'id', 'nom', v_item->>'nom',
        'niveau_avant', v_match->'niveau', 'niveau_apres', v_item->'niveau',
        'xp_delta', COALESCE((v_match->>'xp')::int, 0) - COALESCE((v_item->>'xp')::int, 0)));
    END IF;
  END LOOP;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_avant->'pieges', '[]'::jsonb)) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(p_apres->'pieges', '[]'::jsonb)) e
       WHERE e.value->>'nom' = v_item->>'nom'
    ) THEN
      v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
        'categorie', 'pieges', 'type', 'retrait',
        'id', v_item->>'id', 'nom', v_item->>'nom',
        'niveau_avant', v_item->'niveau',
        'xp_delta', COALESCE((v_item->>'xp')::int, 0)));
    END IF;
  END LOOP;

  -- Sorts & prières : niveau + variables (zone, portée, durée)
  FOREACH v_cat IN ARRAY ARRAY['sorts','prieres'] LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_apres->v_cat, '[]'::jsonb)) LOOP
      SELECT e.value INTO v_match
        FROM jsonb_array_elements(COALESCE(p_avant->v_cat, '[]'::jsonb)) e
       WHERE e.value->>'id' = v_item->>'id' LIMIT 1;
      IF v_match IS NULL THEN
        v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
          'categorie', v_cat, 'type', 'ajout',
          'id', v_item->>'id', 'nom', v_item->>'nom',
          'niveau_apres', v_item->'niveau',
          'xp_delta', -COALESCE((v_item->>'xp')::int, 0)));
      ELSE
        v_changements := '[]'::jsonb;
        IF COALESCE((v_match->>'niveau')::int, 0) <> COALESCE((v_item->>'niveau')::int, 0) THEN
          v_changements := v_changements || jsonb_build_array(jsonb_build_object(
            'champ', 'niveau', 'avant', v_match->'niveau', 'apres', v_item->'niveau'));
        END IF;
        FOREACH v_champ IN ARRAY ARRAY['zone','portee','duree'] LOOP
          IF COALESCE(v_match->>v_champ, '') <> COALESCE(v_item->>v_champ, '') THEN
            v_changements := v_changements || jsonb_build_array(jsonb_build_object(
              'champ', v_champ, 'avant', v_match->v_champ, 'apres', v_item->v_champ));
          END IF;
        END LOOP;
        IF jsonb_array_length(v_changements) > 0 THEN
          v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
            'categorie', v_cat, 'type', 'modification',
            'id', v_item->>'id', 'nom', v_item->>'nom',
            'changements', v_changements,
            'xp_delta', COALESCE((v_match->>'xp')::int, 0) - COALESCE((v_item->>'xp')::int, 0)));
        END IF;
      END IF;
    END LOOP;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_avant->v_cat, '[]'::jsonb)) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_apres->v_cat, '[]'::jsonb)) e
         WHERE e.value->>'id' = v_item->>'id'
      ) THEN
        v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
          'categorie', v_cat, 'type', 'retrait',
          'id', v_item->>'id', 'nom', v_item->>'nom',
          'niveau_avant', v_item->'niveau',
          'xp_delta', COALESCE((v_item->>'xp')::int, 0)));
      END IF;
    END LOOP;
  END LOOP;

  -- Catégories binaires : recettes, assemblages, objets
  FOREACH v_cat IN ARRAY ARRAY['recettes','assemblages','objets_forge','objets_joaillerie'] LOOP
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_apres->v_cat, '[]'::jsonb)) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_avant->v_cat, '[]'::jsonb)) e
         WHERE e.value->>'id' = v_item->>'id'
      ) THEN
        v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
          'categorie', v_cat, 'type', 'ajout',
          'id', v_item->>'id', 'nom', v_item->>'nom',
          'xp_delta', -COALESCE((v_item->>'xp')::int, 0)));
      END IF;
    END LOOP;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_avant->v_cat, '[]'::jsonb)) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(p_apres->v_cat, '[]'::jsonb)) e
         WHERE e.value->>'id' = v_item->>'id'
      ) THEN
        v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
          'categorie', v_cat, 'type', 'retrait',
          'id', v_item->>'id', 'nom', v_item->>'nom',
          'xp_delta', COALESCE((v_item->>'xp')::int, 0)));
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_lignes;
END;
$function$;

CREATE OR REPLACE FUNCTION public.derniere_photo_compo(p_personnage_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_compo jsonb;
BEGIN
  SELECT compo INTO v_compo
  FROM public.personnage_compo_photos
  WHERE personnage_id = p_personnage_id
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v_compo;
END;
$function$;
