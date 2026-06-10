-- AUDIT-JOUEUR-PHASE2 (s151) — Lecture du journal d'évolution
-- 1) diff_compo_photos : delta net entre 2 photos de composition
-- 2) journal_evolution_personnage : blocs événements scellés + fenêtre courante

-- ---------- 1) Diff entre deux compos ----------
-- Convention xp_delta = xp_avant - xp_apres (négatif = dépense, positif = remboursé).
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
  -- Catégories à niveau simple : compétences, pièges
  FOREACH v_cat IN ARRAY ARRAY['competences','pieges'] LOOP
    -- ajouts + changements de niveau
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
      ELSIF COALESCE((v_match->>'niveau')::int, 0) <> COALESCE((v_item->>'niveau')::int, 0) THEN
        v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
          'categorie', v_cat, 'type', 'niveau',
          'id', v_item->>'id', 'nom', v_item->>'nom',
          'niveau_avant', v_match->'niveau', 'niveau_apres', v_item->'niveau',
          'xp_delta', COALESCE((v_match->>'xp')::int, 0) - COALESCE((v_item->>'xp')::int, 0)));
      END IF;
    END LOOP;
    -- retraits
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

-- ---------- 2) RPC de lecture du journal ----------
CREATE OR REPLACE FUNCTION public.journal_evolution_personnage(p_personnage_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_joueur_id uuid;
  v_photos jsonb;
  v_n integer;
  v_i integer;
  v_photo jsonb;
  v_photo_prec jsonb;
  v_blocs jsonb := '[]'::jsonb;
  v_evt record;
  v_lignes jsonb;
  v_fenetre jsonb;
  v_compo_actuelle jsonb;
  v_derniere jsonb;
BEGIN
  SELECT joueur_id INTO v_joueur_id FROM public.personnages WHERE id = p_personnage_id;
  IF v_joueur_id IS NULL THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'personnage_introuvable', 'message', 'Personnage introuvable.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  IF NOT (public.compte_voit_joueur(v_joueur_id) OR public.est_animateur_ou_admin()) THEN
    RETURN jsonb_build_object('succes', false,
      'erreurs', jsonb_build_array(jsonb_build_object('code', 'acces_refuse', 'message', 'Accès refusé.')),
      'avertissements', '[]'::jsonb, 'donnees', '{}'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', ph.id,
           'evenement_id', ph.evenement_id,
           'inscription_id', ph.inscription_id,
           'compo', ph.compo,
           'acteur_id', ph.acteur_id,
           'created_at', ph.created_at
         ) ORDER BY ph.created_at), '[]'::jsonb)
    INTO v_photos
    FROM public.personnage_compo_photos ph
   WHERE ph.personnage_id = p_personnage_id;

  v_n := jsonb_array_length(v_photos);

  IF v_n = 0 THEN
    RETURN jsonb_build_object('succes', true,
      'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
      'donnees', jsonb_build_object(
        'a_participe', false, 'fenetre_courante', NULL, 'evenements', '[]'::jsonb));
  END IF;

  -- Blocs scellés, construits du plus récent au plus ancien
  v_i := v_n - 1;
  WHILE v_i >= 0 LOOP
    v_photo := v_photos->v_i;

    SELECT e.titre, e.type_evenement, e.date_evenement, e.niveaux_recompense,
           i.xp_attribue
      INTO v_evt
      FROM public.evenements e
      LEFT JOIN public.inscriptions_evenements i
        ON i.id = NULLIF(v_photo->>'inscription_id','')::uuid
     WHERE e.id = NULLIF(v_photo->>'evenement_id','')::uuid;

    IF v_i = 0 THEN
      v_lignes := '[]'::jsonb;
    ELSE
      v_photo_prec := v_photos->(v_i - 1);
      v_lignes := public.diff_compo_photos(v_photo_prec->'compo', v_photo->'compo');
    END IF;

    v_blocs := v_blocs || jsonb_build_array(jsonb_build_object(
      'evenement_id', v_photo->'evenement_id',
      'titre', COALESCE(v_evt.titre, 'Événement supprimé'),
      'type_evenement', v_evt.type_evenement,
      'date_evenement', v_evt.date_evenement,
      'date_confirmation', v_photo->'created_at',
      'acteur_nom', public.nom_profil_principal(NULLIF(v_photo->>'acteur_id','')::uuid),
      'xp_recompense', v_evt.xp_attribue,
      'niveau_up', (v_evt.type_evenement = 'gn_regulier' OR COALESCE(v_evt.niveaux_recompense, 0) > 0),
      'premiere', (v_i = 0),
      'lignes', v_lignes));

    v_i := v_i - 1;
  END LOOP;

  -- Fenêtre courante : dernière photo → compo actuelle
  v_derniere := v_photos->(v_n - 1);
  v_compo_actuelle := public.capturer_compo_personnage(p_personnage_id);
  SELECT e.titre, e.date_evenement INTO v_evt
    FROM public.evenements e
   WHERE e.id = NULLIF(v_derniere->>'evenement_id','')::uuid;
  v_fenetre := jsonb_build_object(
    'depuis_evenement_titre', COALESCE(v_evt.titre, 'Événement supprimé'),
    'depuis_date', v_derniere->'created_at',
    'lignes', public.diff_compo_photos(v_derniere->'compo', v_compo_actuelle));

  RETURN jsonb_build_object('succes', true,
    'erreurs', '[]'::jsonb, 'avertissements', '[]'::jsonb,
    'donnees', jsonb_build_object(
      'a_participe', true,
      'fenetre_courante', v_fenetre,
      'evenements', v_blocs));
END;
$function$;
