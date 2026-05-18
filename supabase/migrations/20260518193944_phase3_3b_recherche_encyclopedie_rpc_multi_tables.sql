-- Phase 3.3b : RPC rechercher_encyclopedie refactoré pour UNION ALL multi-tables
-- Types retournés : 'lore', 'bestiaire', 'religion', 'competence'
-- Signature de retour inchangée pour compatibilité frontend

CREATE OR REPLACE FUNCTION public.rechercher_encyclopedie(p_terme text)
RETURNS TABLE(type text, id uuid, titre text, sous_titre text, categorie text, snippet text, rang real)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_query tsquery;
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
    SELECT
      'lore'::text AS type,
      l.id,
      l.nom AS titre,
      l.sous_titre,
      l.categorie,
      ts_headline('french', coalesce(l.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(l.recherche_tsv, v_query) AS rang
    FROM lore l
    WHERE l.est_actif = true
      AND l.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'bestiaire'::text AS type,
      b.id,
      b.nom AS titre,
      NULL::text AS sous_titre,
      b.categorie,
      ts_headline('french', coalesce(b.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(b.recherche_tsv, v_query) AS rang
    FROM bestiaire b
    WHERE b.est_actif = true
      AND b.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'religion'::text AS type,
      r.id,
      r.nom AS titre,
      r.dirigeant AS sous_titre,
      'religion'::text AS categorie,
      ts_headline('french', coalesce(r.description_longue, r.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(r.recherche_tsv, v_query) AS rang
    FROM religions r
    WHERE r.est_actif = true
      AND r.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT
      'competence'::text AS type,
      c.id,
      c.nom AS titre,
      NULL::text AS sous_titre,
      c.categorie,
      ts_headline('french', coalesce(c.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10') AS snippet,
      ts_rank(c.recherche_tsv, v_query) AS rang
    FROM competences c
    WHERE c.est_actif = true
      AND c.recherche_tsv @@ v_query
  )
  ORDER BY rang DESC
  LIMIT 50;
END;
$function$;
