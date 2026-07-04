-- P1-c MODE-VISITEUR : générateurs de fixtures de parité par type (fragment A : magie + traits).
-- Contextes = personnages éditables anonymisés ; cas déterministes (ORDER BY partout) ;
-- verdicts = gates pures. Consommé via le dispatcher fixtures_parite_visiteur_type (fragment B).
-- ⚠️ Capturé en période de GEL : filtre gate_edition_personnage IS NULL → recapture post-GN.

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_sorts()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_sorts$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo
    FROM personnages pe
    WHERE pe.est_actif AND NOT pe.est_mort
      AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
      AND EXISTS (SELECT 1 FROM vue_cercles_disponibles v WHERE v.personnage_id = pe.id)
    ORDER BY (SELECT count(*) FROM vue_cercles_disponibles v WHERE v.personnage_id = pe.id) DESC, pe.id
    LIMIT 3
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'xp_dispo', p.xp_dispo,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id, 'competence_nom', c.nom, 'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis, 'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id)));
    FOR d IN
      (SELECT s.id AS sort_id, s.nom, v.cercle, 1 AS niveau,
              'Personnelle'::text AS zone, 'Toucher'::text AS portee, 'Instantanée'::text AS duree, 1 AS ordre
       FROM vue_cercles_disponibles v
       JOIN LATERAL (SELECT id, nom FROM sorts WHERE cercle = v.cercle ORDER BY cout_xp_base ASC, nom, id LIMIT 1) s ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT s.id, s.nom, v.cercle, v.niveau_max_sorts,
              'Rayon 50 pieds', 'À vue', '60 Minutes', 2
       FROM vue_cercles_disponibles v
       JOIN LATERAL (SELECT id, nom FROM sorts WHERE cercle = v.cercle ORDER BY cout_xp_base DESC, nom, id LIMIT 1) s ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT s.id, s.nom, v.cercle, v.niveau_max_sorts + 1,
              '1 Cible', 'Toucher', 'Instantanée', 3
       FROM vue_cercles_disponibles v
       JOIN LATERAL (SELECT id, nom FROM sorts WHERE cercle = v.cercle ORDER BY cout_xp_base ASC, nom, id LIMIT 1) s ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT s.id, s.nom, s.cercle, 1, '1 Cible', 'Toucher', 'Instantanée', 4
       FROM sorts s
       WHERE NOT EXISTS (SELECT 1 FROM vue_cercles_disponibles v WHERE v.personnage_id = p.id AND v.cercle = s.cercle)
       ORDER BY s.nom, s.id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', NULL, 1, '1 Cible', 'Toucher', 'Instantanée', 5)
      ORDER BY ordre, cercle, nom, niveau
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('sort_id', d.sort_id, 'sort_nom', d.nom,
          'niveau_sort', d.niveau, 'zone_choisie', d.zone, 'portee_choisie', d.portee, 'duree_choisie', d.duree),
        'verdict', public.peut_acheter_sort(p.id, d.sort_id, d.niveau, d.zone, d.portee, d.duree)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_sorts: aucun personnage editable avec cercle (fenetre de gel ?)';
  END IF;
  RETURN jsonb_build_object('type', 'sorts', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_sorts$;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_prieres()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_prieres$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT pe.id, pe.religion_id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo,
           (r.domaines_proscrits IS NOT NULL) AS a_proscrits
    FROM personnages pe
    LEFT JOIN religions r ON r.id = pe.religion_id
    WHERE pe.est_actif AND NOT pe.est_mort
      AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
      AND EXISTS (SELECT 1 FROM vue_domaines_disponibles v WHERE v.personnage_id = pe.id)
    ORDER BY (r.domaines_proscrits IS NOT NULL) DESC,
             (SELECT count(*) FROM vue_domaines_disponibles v WHERE v.personnage_id = pe.id) DESC, pe.id
    LIMIT 3
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'xp_dispo', p.xp_dispo, 'religion_id', p.religion_id,
      'competences_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'competence_id', pc.competence_id, 'competence_nom', c.nom, 'categorie', c.categorie,
          'niveau_acquis', pc.niveau_acquis, 'choix_achat', pc.choix_achat)
          ORDER BY c.nom, pc.niveau_acquis, pc.choix_achat), '[]'::jsonb)
        FROM personnage_competences pc JOIN competences c ON c.id = pc.competence_id
        WHERE pc.personnage_id = p.id)));
    FOR d IN
      (SELECT pr.id AS priere_id, pr.nom, v.domaine, 1 AS niveau,
              'Personnelle'::text AS zone, 'Toucher'::text AS portee, 'Instantanée'::text AS duree, 1 AS ordre
       FROM vue_domaines_disponibles v
       JOIN LATERAL (SELECT id, nom FROM prieres WHERE domaine = v.domaine ORDER BY cout_xp_base ASC, nom, id LIMIT 1) pr ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT pr.id, pr.nom, v.domaine, v.niveau_max_prieres,
              'Rayon 50 pieds', 'À vue', '60 Minutes', 2
       FROM vue_domaines_disponibles v
       JOIN LATERAL (SELECT id, nom FROM prieres WHERE domaine = v.domaine ORDER BY cout_xp_base DESC, nom, id LIMIT 1) pr ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT pr.id, pr.nom, v.domaine, v.niveau_max_prieres + 1,
              '1 Cible', 'Toucher', 'Instantanée', 3
       FROM vue_domaines_disponibles v
       JOIN LATERAL (SELECT id, nom FROM prieres WHERE domaine = v.domaine ORDER BY cout_xp_base ASC, nom, id LIMIT 1) pr ON true
       WHERE v.personnage_id = p.id)
      UNION ALL
      (SELECT pr.id, pr.nom, pr.domaine, 1, '1 Cible', 'Toucher', 'Instantanée', 4
       FROM prieres pr
       WHERE NOT EXISTS (SELECT 1 FROM vue_domaines_disponibles v WHERE v.personnage_id = p.id AND v.domaine = pr.domaine)
       ORDER BY pr.nom, pr.id LIMIT 1)
      UNION ALL
      (SELECT pr.id, pr.nom, pr.domaine, 1, '1 Cible', 'Toucher', 'Instantanée', 5
       FROM personnages pe2
       JOIN religions r2 ON r2.id = pe2.religion_id
       CROSS JOIN LATERAL (SELECT id, nom, domaine FROM prieres WHERE domaine = ANY(r2.domaines_proscrits) ORDER BY nom, id LIMIT 1) pr
       WHERE pe2.id = p.id AND r2.domaines_proscrits IS NOT NULL)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', NULL, 1, '1 Cible', 'Toucher', 'Instantanée', 6)
      ORDER BY ordre, domaine, nom, niveau
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('priere_id', d.priere_id, 'priere_nom', d.nom,
          'niveau_priere', d.niveau, 'zone_choisie', d.zone, 'portee_choisie', d.portee, 'duree_choisie', d.duree),
        'verdict', public.peut_acheter_priere(p.id, d.priere_id, d.niveau, d.zone, d.portee, d.duree)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_prieres: aucun personnage editable avec domaine (fenetre de gel ?)';
  END IF;
  RETURN jsonb_build_object('type', 'prieres', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_prieres$;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_traits_raciaux()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_traits$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT DISTINCT ON (u.id) u.id, u.race_id, u.traits, u.xp_dispo FROM (
      (SELECT pe.id, pe.race_id, COALESCE(pe.traits_raciaux_choisis, '[]'::jsonb) AS traits,
              COALESCE(jsonb_array_length(pe.traits_raciaux_choisis), 0) AS nb,
              (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo
       FROM personnages pe
       WHERE pe.est_actif AND NOT pe.est_mort AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
       ORDER BY COALESCE(jsonb_array_length(pe.traits_raciaux_choisis), 0) DESC, pe.id LIMIT 2)
      UNION ALL
      (SELECT pe.id, pe.race_id, COALESCE(pe.traits_raciaux_choisis, '[]'::jsonb),
              COALESCE(jsonb_array_length(pe.traits_raciaux_choisis), 0),
              (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0))
       FROM personnages pe
       WHERE pe.est_actif AND NOT pe.est_mort AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
       ORDER BY COALESCE(jsonb_array_length(pe.traits_raciaux_choisis), 0) ASC, pe.id LIMIT 2)
    ) u ORDER BY u.id
  LOOP
    v_ref := v_ref + 1;
    v_contextes := v_contextes || jsonb_build_array(jsonb_build_object(
      'ref', v_ref, 'race_id', p.race_id, 'xp_dispo', p.xp_dispo,
      'traits_raciaux_choisis', p.traits));
    FOR d IN
      (SELECT rt.trait_id, t.nom, p.race_id AS race_cible, NULL::text AS sous_type, 1 AS ordre
       FROM race_traits rt JOIN traits_raciaux t ON t.id = rt.trait_id
       WHERE rt.race_id = p.race_id
         AND NOT (p.traits @> jsonb_build_array(jsonb_build_object('trait_id', rt.trait_id)))
       ORDER BY t.nom, rt.trait_id LIMIT 2)
      UNION ALL
      (SELECT (e.val->>'trait_id')::uuid, 'DEJA-ACQUIS', p.race_id, NULL::text, 2
       FROM jsonb_array_elements(p.traits) e(val)
       WHERE e.val ? 'trait_id'
       ORDER BY e.val->>'trait_id' LIMIT 1)
      UNION ALL
      (SELECT rt.trait_id, t.nom, p.race_id, NULL::text, 3
       FROM race_traits rt JOIN traits_raciaux t ON t.id = rt.trait_id
       WHERE rt.race_id <> p.race_id
         AND NOT EXISTS (SELECT 1 FROM race_traits rt2 WHERE rt2.race_id = p.race_id AND rt2.trait_id = rt.trait_id)
       ORDER BY t.nom, rt.trait_id LIMIT 1)
      UNION ALL
      (SELECT rt.trait_id, t.nom, p.race_id, rt.sous_type, 4
       FROM race_traits rt JOIN traits_raciaux t ON t.id = rt.trait_id
       WHERE rt.race_id = p.race_id AND rt.sous_type IS NOT NULL
       ORDER BY rt.sous_type, t.nom, rt.trait_id LIMIT 1)
      UNION ALL
      (SELECT rt.trait_id, t.nom, p.race_id, 'FIXTURE-SOUS-TYPE'::text, 5
       FROM race_traits rt JOIN traits_raciaux t ON t.id = rt.trait_id
       WHERE rt.race_id = p.race_id
       ORDER BY t.nom, rt.trait_id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', p.race_id, NULL::text, 6)
      ORDER BY ordre, nom
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('trait_id', d.trait_id, 'trait_nom', d.nom, 'race_id', d.race_cible, 'sous_type', d.sous_type),
        'verdict', public.peut_acheter_trait_racial(p.id, d.trait_id, d.race_cible, d.sous_type)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_traits_raciaux: aucun personnage editable (fenetre de gel ?)';
  END IF;
  RETURN jsonb_build_object('type', 'traits_raciaux', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_traits$;
