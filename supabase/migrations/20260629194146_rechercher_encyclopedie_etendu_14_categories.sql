-- Recherche globale 14 catégories (PR3b-5a) — extension du RPC.
-- 7 sources existantes + 8 nouvelles (pieges dédoublonné par nom).

CREATE OR REPLACE FUNCTION public.rechercher_encyclopedie(p_terme text)
 RETURNS TABLE(type text, id uuid, titre text, sous_titre text, categorie text, snippet text, rang real)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_query tsquery;
  v_opts text := 'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10';
BEGIN
  IF p_terme IS NULL OR length(trim(p_terme)) < 2 THEN
    RETURN;
  END IF;
  v_query := plainto_tsquery('french', p_terme);
  IF v_query::text = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  (
    SELECT 'lore'::text AS type, l.id, l.nom AS titre, l.sous_titre AS sous_titre, l.categorie AS categorie,
      ts_headline('french', coalesce(l.description, ''), v_query, v_opts) AS snippet,
      ts_rank(l.recherche_tsv, v_query) AS rang
    FROM lore l WHERE l.est_actif = true AND l.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'bestiaire'::text, b.id, b.nom, NULL::text, b.categorie,
      ts_headline('french', coalesce(b.description, ''), v_query, v_opts),
      ts_rank(b.recherche_tsv, v_query)
    FROM bestiaire b WHERE b.est_actif = true AND b.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'religion'::text, r.id, r.nom, r.dirigeant, 'religion'::text,
      ts_headline('french', coalesce(r.description_longue, r.description, ''), v_query, v_opts),
      ts_rank(r.recherche_tsv, v_query)
    FROM religions r WHERE r.est_actif = true AND r.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'competence'::text, c.id, c.nom, NULL::text, c.categorie,
      ts_headline('french', coalesce(c.description, ''), v_query, v_opts),
      ts_rank(c.recherche_tsv, v_query)
    FROM competences c WHERE c.est_actif = true AND c.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'sort'::text, s.id, s.nom, s.cercle, s.type_sort,
      ts_headline('french', coalesce(s.description, ''), v_query, v_opts),
      ts_rank(s.recherche_tsv, v_query)
    FROM sorts s WHERE s.est_actif = true AND s.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'priere'::text, p.id, p.nom, p.domaine, p.type_priere,
      ts_headline('french', coalesce(p.description, ''), v_query, v_opts),
      ts_rank(p.recherche_tsv, v_query)
    FROM prieres p WHERE p.est_actif = true AND p.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'regle'::text, sr.id, sr.titre, sr.categorie, 'regle'::text,
      ts_headline('french', coalesce(sr.contenu, ''), v_query, v_opts),
      ts_rank(sr.recherche_tsv, v_query)
    FROM sections_regles sr WHERE sr.est_actif = true AND sr.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'race'::text, ra.id, ra.nom, NULL::text, 'race'::text,
      ts_headline('french', coalesce(ra.description, ''), v_query, v_opts),
      ts_rank(ra.recherche_tsv, v_query)
    FROM races ra WHERE ra.est_actif = true AND ra.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'trait_racial'::text, tr.id, tr.nom, NULL::text, 'trait_racial'::text,
      ts_headline('french', coalesce(tr.description, ''), v_query, v_opts),
      ts_rank(tr.recherche_tsv, v_query)
    FROM traits_raciaux tr WHERE tr.est_actif = true AND tr.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'classe'::text, cl.id, cl.nom, cl.role_combat, 'classe'::text,
      ts_headline('french', coalesce(cl.description, ''), v_query, v_opts),
      ts_rank(cl.recherche_tsv, v_query)
    FROM classes cl WHERE cl.est_actif = true AND cl.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'forge'::text, f.id, f.nom, f.type, 'forge'::text,
      ts_headline('french', coalesce(nullif(f.description, ''), f.effet, ''), v_query, v_opts),
      ts_rank(f.recherche_tsv, v_query)
    FROM objets_forge f WHERE f.est_actif = true AND f.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'joaillerie'::text, j.id, j.nom, NULL::text, 'joaillerie'::text,
      ts_headline('french', coalesce(nullif(j.description, ''), j.effet, ''), v_query, v_opts),
      ts_rank(j.recherche_tsv, v_query)
    FROM objets_joaillerie j WHERE j.est_actif = true AND j.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'alchimie'::text, al.id, al.nom, al.type, 'alchimie'::text,
      ts_headline('french', coalesce(nullif(al.description, ''), al.effet, ''), v_query, v_opts),
      ts_rank(al.recherche_tsv, v_query)
    FROM recettes_alchimie al WHERE al.est_actif = true AND al.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'assemblages'::text, asr.id, asr.nom, asr.cible, 'assemblages'::text,
      ts_headline('french', coalesce(nullif(asr.description, ''), asr.effet, ''), v_query, v_opts),
      ts_rank(asr.recherche_tsv, v_query)
    FROM assemblages_runes asr WHERE asr.est_actif = true AND asr.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT pg_dedup.type, pg_dedup.id, pg_dedup.titre, pg_dedup.sous_titre, pg_dedup.categorie, pg_dedup.snippet, pg_dedup.rang
    FROM (
      SELECT DISTINCT ON (pg.nom)
        'pieges'::text AS type, pg.id, pg.nom AS titre, pg.type_piege AS sous_titre, 'pieges'::text AS categorie,
        ts_headline('french', coalesce(nullif(pg.effets, ''), pg.effet_generique, ''), v_query, v_opts) AS snippet,
        ts_rank(pg.recherche_tsv, v_query) AS rang
      FROM pieges pg
      WHERE pg.est_actif = true AND pg.recherche_tsv @@ v_query
      ORDER BY pg.nom, ts_rank(pg.recherche_tsv, v_query) DESC
    ) pg_dedup
  )
  ORDER BY rang DESC
  LIMIT 50;
END;
$function$;
