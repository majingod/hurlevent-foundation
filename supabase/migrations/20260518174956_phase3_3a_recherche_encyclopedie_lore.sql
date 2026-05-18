-- 1. Generated column tsvector sur lore (idempotent)
ALTER TABLE public.lore 
  ADD COLUMN IF NOT EXISTS recherche_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(nom, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(sous_titre, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(description, '')), 'C')
  ) STORED;

-- 2. Index GIN
CREATE INDEX IF NOT EXISTS idx_lore_recherche_tsv 
  ON public.lore USING GIN(recherche_tsv);

-- 3. RPC de recherche
CREATE OR REPLACE FUNCTION public.rechercher_encyclopedie(p_terme text)
RETURNS TABLE(
  type text,
  id uuid,
  titre text,
  sous_titre text,
  categorie text,
  snippet text,
  rang real
)
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
  ORDER BY rang DESC
  LIMIT 50;
END;
$function$;
