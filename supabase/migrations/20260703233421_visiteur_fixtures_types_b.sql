-- P1-c MODE-VISITEUR : générateurs de fixtures par type (fragment B : artisanat) + dispatcher.
-- fixtures_parite_visiteur_type(p_type) = point d'entrée PostgREST (nom distinct de
-- fixtures_parite_visiteur() pour éviter toute ambiguïté d'overload PostgREST).
-- Types : sorts | prieres | traits_raciaux | pieges | recettes | assemblages.
-- ⚠️ Capturé en période de GEL : recapture post-GN (contexte pièges pauvre : 1 seul artisan).

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_pieges()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_pieges$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT DISTINCT ON (u.id) u.id, u.xp_dispo FROM (
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo, q.niveau_pieges
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
         AND q.niveau_pieges >= 1
       ORDER BY q.niveau_pieges DESC, pe.id LIMIT 2)
      UNION ALL
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)), q.niveau_pieges
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
         AND q.niveau_pieges = 0
       ORDER BY pe.id LIMIT 1)
    ) u ORDER BY u.id
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
        WHERE pc.personnage_id = p.id),
      'pieges_acquis', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'piege_nom', pp.piege_nom, 'niveau_acquis', pp.niveau_acquis, 'est_gratuit', pp.est_gratuit)
          ORDER BY pp.piege_nom, pp.niveau_acquis), '[]'::jsonb)
        FROM personnage_pieges pp WHERE pp.personnage_id = p.id)));
    FOR d IN
      (SELECT pg.id AS piege_id, pg.nom, pg.niveau, 1 AS ordre
       FROM pieges pg
       WHERE pg.niveau = 1
         AND NOT EXISTS (SELECT 1 FROM personnage_pieges pp WHERE pp.personnage_id = p.id AND pp.piege_nom = pg.nom AND pp.niveau_acquis = 1)
       ORDER BY pg.nom, pg.id LIMIT 1)
      UNION ALL
      (SELECT pg.id, pg.nom, pg.niveau, 2
       FROM pieges pg
       WHERE pg.niveau = 2
         AND EXISTS (SELECT 1 FROM personnage_pieges pp WHERE pp.personnage_id = p.id AND pp.piege_nom = pg.nom AND pp.niveau_acquis = 1)
         AND NOT EXISTS (SELECT 1 FROM personnage_pieges pp WHERE pp.personnage_id = p.id AND pp.piege_nom = pg.nom AND pp.niveau_acquis = 2)
       ORDER BY pg.nom, pg.id LIMIT 1)
      UNION ALL
      (SELECT pg.id, pg.nom, pg.niveau, 3
       FROM pieges pg
       WHERE pg.niveau = 2
         AND NOT EXISTS (SELECT 1 FROM personnage_pieges pp WHERE pp.personnage_id = p.id AND pp.piege_nom = pg.nom AND pp.niveau_acquis = 1)
       ORDER BY pg.nom, pg.id LIMIT 1)
      UNION ALL
      (SELECT pg.id, pg.nom, pg.niveau, 4
       FROM personnage_pieges pp
       JOIN pieges pg ON pg.nom = pp.piege_nom AND pg.niveau = pp.niveau_acquis
       WHERE pp.personnage_id = p.id
       ORDER BY pg.nom, pg.id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', 0, 5)
      ORDER BY ordre, nom
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('piege_id', d.piege_id, 'piege_nom', d.nom, 'niveau', d.niveau),
        'verdict', public.peut_acheter_piege(p.id, d.piege_id)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_pieges: aucun personnage editable (fenetre de gel ?)';
  END IF;
  RETURN jsonb_build_object('type', 'pieges', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_pieges$;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_recettes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_recettes$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT DISTINCT ON (u.id) u.id, u.xp_dispo FROM (
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
         AND q.niveau_alchimie >= 1
       ORDER BY q.niveau_alchimie DESC, pe.id LIMIT 2)
      UNION ALL
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0))
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
         AND q.niveau_alchimie = 0
       ORDER BY pe.id LIMIT 1)
    ) u ORDER BY u.id
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
        WHERE pc.personnage_id = p.id),
      'recettes_acquises', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'recette_id', pr.recette_id, 'est_gratuit', pr.est_gratuit)
          ORDER BY pr.recette_id), '[]'::jsonb)
        FROM personnage_recettes pr WHERE pr.personnage_id = p.id)));
    FOR d IN
      (SELECT ra.id AS recette_id, ra.nom, ra.niveau_requis, 1 AS ordre
       FROM recettes_alchimie ra
       WHERE ra.niveau_requis = 1
         AND NOT EXISTS (SELECT 1 FROM personnage_recettes pr WHERE pr.personnage_id = p.id AND pr.recette_id = ra.id)
       ORDER BY ra.nom, ra.id LIMIT 1)
      UNION ALL
      (SELECT ra.id, ra.nom, ra.niveau_requis, 2
       FROM recettes_alchimie ra
       WHERE ra.niveau_requis = 2
         AND NOT EXISTS (SELECT 1 FROM personnage_recettes pr WHERE pr.personnage_id = p.id AND pr.recette_id = ra.id)
       ORDER BY ra.nom, ra.id LIMIT 1)
      UNION ALL
      (SELECT ra.id, ra.nom, ra.niveau_requis, 3
       FROM recettes_alchimie ra
       WHERE ra.niveau_requis = 3
         AND NOT EXISTS (SELECT 1 FROM personnage_recettes pr WHERE pr.personnage_id = p.id AND pr.recette_id = ra.id)
       ORDER BY ra.nom, ra.id LIMIT 1)
      UNION ALL
      (SELECT ra.id, ra.nom, ra.niveau_requis, 4
       FROM personnage_recettes pr JOIN recettes_alchimie ra ON ra.id = pr.recette_id
       WHERE pr.personnage_id = p.id
       ORDER BY ra.nom, ra.id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', 0, 5)
      ORDER BY ordre, nom
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('recette_id', d.recette_id, 'recette_nom', d.nom, 'niveau_requis', d.niveau_requis),
        'verdict', public.peut_acheter_recette(p.id, d.recette_id)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_recettes: aucun personnage editable (fenetre de gel ?)';
  END IF;
  RETURN jsonb_build_object('type', 'recettes', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_recettes$;

CREATE OR REPLACE FUNCTION public.fixtures_visiteur_assemblages()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_ass$
DECLARE
  v_contextes jsonb := '[]'::jsonb; v_cas jsonb := '[]'::jsonb; v_ref integer := 0;
  p record; d record;
BEGIN
  FOR p IN
    SELECT DISTINCT ON (u.id) u.id, u.xp_dispo FROM (
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0)) AS xp_dispo
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
         AND q.niveau_runes >= 1
       ORDER BY q.niveau_runes DESC, pe.id LIMIT 2)
      UNION ALL
      (SELECT pe.id, (COALESCE(pe.xp_total,0)-COALESCE(pe.xp_depense,0))
       FROM personnages pe JOIN vue_artisanat_quotas q ON q.personnage_id = pe.id
       WHERE pe.est_actif AND NOT pe.est_mort AND public.gate_edition_personnage(pe.id,'ajout') IS NULL
         AND q.niveau_runes = 0
       ORDER BY pe.id LIMIT 1)
    ) u ORDER BY u.id
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
        WHERE pc.personnage_id = p.id),
      'assemblages_acquis', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'assemblage_id', pa.assemblage_id, 'est_gratuit', pa.est_gratuit)
          ORDER BY pa.assemblage_id), '[]'::jsonb)
        FROM personnage_assemblages pa WHERE pa.personnage_id = p.id)));
    FOR d IN
      (SELECT ar.id AS assemblage_id, ar.nom, 1 AS ordre
       FROM assemblages_runes ar
       WHERE NOT EXISTS (SELECT 1 FROM personnage_assemblages pa WHERE pa.personnage_id = p.id AND pa.assemblage_id = ar.id)
       ORDER BY ar.cout_xp ASC, ar.nom, ar.id LIMIT 1)
      UNION ALL
      (SELECT ar.id, ar.nom, 2
       FROM assemblages_runes ar
       WHERE NOT EXISTS (SELECT 1 FROM personnage_assemblages pa WHERE pa.personnage_id = p.id AND pa.assemblage_id = ar.id)
       ORDER BY ar.cout_xp DESC, ar.nom, ar.id LIMIT 1)
      UNION ALL
      (SELECT ar.id, ar.nom, 3
       FROM personnage_assemblages pa JOIN assemblages_runes ar ON ar.id = pa.assemblage_id
       WHERE pa.personnage_id = p.id
       ORDER BY ar.nom, ar.id LIMIT 1)
      UNION ALL
      (SELECT '00000000-0000-0000-0000-000000000000'::uuid, 'INEXISTANT', 4)
      ORDER BY ordre, nom
    LOOP
      v_cas := v_cas || jsonb_build_array(jsonb_build_object(
        'ctx', v_ref,
        'demande', jsonb_build_object('assemblage_id', d.assemblage_id, 'assemblage_nom', d.nom),
        'verdict', public.peut_acheter_assemblage(p.id, d.assemblage_id)));
    END LOOP;
  END LOOP;
  IF v_ref = 0 THEN
    RAISE EXCEPTION 'fixtures_visiteur_assemblages: aucun personnage editable (fenetre de gel ?)';
  END IF;
  RETURN jsonb_build_object('type', 'assemblages', 'genere_le', now(), 'nb_contextes', v_ref, 'nb_cas', jsonb_array_length(v_cas), 'contextes', v_contextes, 'cas', v_cas);
END;
$fx_ass$;

CREATE OR REPLACE FUNCTION public.fixtures_parite_visiteur_type(p_type text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fx_dispatch$
BEGIN
  RETURN CASE p_type
    WHEN 'sorts' THEN public.fixtures_visiteur_sorts()
    WHEN 'prieres' THEN public.fixtures_visiteur_prieres()
    WHEN 'traits_raciaux' THEN public.fixtures_visiteur_traits_raciaux()
    WHEN 'pieges' THEN public.fixtures_visiteur_pieges()
    WHEN 'recettes' THEN public.fixtures_visiteur_recettes()
    WHEN 'assemblages' THEN public.fixtures_visiteur_assemblages()
    ELSE jsonb_build_object('erreur', format('type inconnu: %s', p_type))
  END;
END;
$fx_dispatch$;

REVOKE ALL ON FUNCTION public.fixtures_parite_visiteur_type(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fixtures_parite_visiteur_type(text) TO anon, authenticated, service_role;
