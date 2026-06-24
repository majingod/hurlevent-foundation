-- Stèle enrichie (Temps 1) : _figer_stele capture aussi snapshot.details
-- (compétences dédup sans méta, sorts/prières/assemblages/recettes) pour la modal mémorial enrichie.
-- Signature inchangée (3 args) → types.ts non impacté. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public._figer_stele(p_personnage_id uuid, p_epitaphe text, p_cree_par uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot jsonb; v_details jsonb; v_nom text; v_race text; v_classe text; v_niveau int;
  v_joueur_nom text; v_id uuid;
BEGIN
  SELECT to_jsonb(f.*), f.nom, f.race_nom, f.classe_nom, f.niveau, pj.nom
    INTO v_snapshot, v_nom, v_race, v_classe, v_niveau, v_joueur_nom
    FROM public.vue_fiche_personnage f
    LEFT JOIN public.profils_joueur pj ON pj.id = f.joueur_id
    WHERE f.id = p_personnage_id;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Personnage introuvable pour la stele: %', p_personnage_id;
  END IF;

  -- Détails du savoir-faire (capturés AVANT le passage en est_mort)
  v_details := jsonb_build_object(
    'competences', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nom', nom, 'categorie', categorie, 'niveau', niveau) ORDER BY niveau DESC, nom)
      FROM (
        SELECT nom, categorie, max(niveau_acquis) AS niveau
        FROM public.vue_competences_personnage
        WHERE personnage_id = p_personnage_id
          AND nom NOT LIKE 'Acquisition de %'
        GROUP BY nom, categorie
      ) c
    ), '[]'::jsonb),
    'sorts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nom', nom, 'cercle', cercle, 'niveau', niveau) ORDER BY cercle, niveau DESC, nom)
      FROM (
        SELECT COALESCE(nom_personnalise, sort_nom_base) AS nom, cercle, max(niveau_sort) AS niveau
        FROM public.vue_sorts_personnage
        WHERE personnage_id = p_personnage_id
        GROUP BY COALESCE(nom_personnalise, sort_nom_base), cercle
      ) s
    ), '[]'::jsonb),
    'prieres', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nom', nom, 'domaine', domaine, 'niveau', niveau) ORDER BY domaine, niveau DESC, nom)
      FROM (
        SELECT nom_personnalise AS nom, domaine, max(niveau_priere) AS niveau
        FROM public.vue_prieres_personnage
        WHERE personnage_id = p_personnage_id
        GROUP BY nom_personnalise, domaine
      ) p
    ), '[]'::jsonb),
    'assemblages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nom', nom, 'effet', effet) ORDER BY nom)
      FROM public.vue_assemblages_personnage
      WHERE personnage_id = p_personnage_id
    ), '[]'::jsonb),
    'recettes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nom', nom, 'type', type) ORDER BY type, nom)
      FROM public.vue_recettes_personnage
      WHERE personnage_id = p_personnage_id
    ), '[]'::jsonb)
  );

  v_snapshot := v_snapshot || jsonb_build_object('details', v_details);

  INSERT INTO public.cimetiere (personnage_id_origine, nom, race, classe, niveau, joueur_nom, epitaphe, snapshot, cree_par)
  VALUES (p_personnage_id, v_nom, v_race, v_classe, v_niveau, v_joueur_nom,
          NULLIF(trim(COALESCE(p_epitaphe,'')),''), v_snapshot, p_cree_par)
  RETURNING id INTO v_id;

  UPDATE public.personnages SET est_mort = true WHERE id = p_personnage_id;
  RETURN v_id;
END;
$function$;
