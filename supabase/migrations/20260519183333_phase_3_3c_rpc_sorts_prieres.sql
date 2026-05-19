-- Phase 3.3c : RPC rechercher_encyclopedie étendu aux sorts et prieres
-- Types retournés : lore, bestiaire, religion, competence, sort, priere
-- Signature de retour inchangée
--
-- NOTE: cette version omet les alias AS explicites, ce qui fait planter
-- ORDER BY rang DESC à l'exécution. Corrigée par la migration
-- 20260519183412_phase_3_3c_rpc_sorts_prieres_fix_alias.sql.
-- Conservée telle quelle pour refléter schema_migrations exactement.

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
    SELECT 'lore'::text, l.id, l.nom, l.sous_titre, l.categorie,
      ts_headline('french', coalesce(l.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10'),
      ts_rank(l.recherche_tsv, v_query)
    FROM lore l
    WHERE l.est_actif = true AND l.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'bestiaire'::text, b.id, b.nom, NULL::text, b.categorie,
      ts_headline('french', coalesce(b.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10'),
      ts_rank(b.recherche_tsv, v_query)
    FROM bestiaire b
    WHERE b.est_actif = true AND b.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'religion'::text, r.id, r.nom, r.dirigeant, 'religion'::text,
      ts_headline('french', coalesce(r.description_longue, r.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10'),
      ts_rank(r.recherche_tsv, v_query)
    FROM religions r
    WHERE r.est_actif = true AND r.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'competence'::text, c.id, c.nom, NULL::text, c.categorie,
      ts_headline('french', coalesce(c.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10'),
      ts_rank(c.recherche_tsv, v_query)
    FROM competences c
    WHERE c.est_actif = true AND c.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'sort'::text, s.id, s.nom, s.cercle, s.type_sort,
      ts_headline('french', coalesce(s.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10'),
      ts_rank(s.recherche_tsv, v_query)
    FROM sorts s
    WHERE s.est_actif = true AND s.recherche_tsv @@ v_query
  )
  UNION ALL
  (
    SELECT 'priere'::text, p.id, p.nom, p.domaine, p.type_priere,
      ts_headline('french', coalesce(p.description, ''), v_query,
        'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=30, MinWords=10'),
      ts_rank(p.recherche_tsv, v_query)
    FROM prieres p
    WHERE p.est_actif = true AND p.recherche_tsv @@ v_query
  )
  ORDER BY rang DESC
  LIMIT 50;
END;
$function$;
