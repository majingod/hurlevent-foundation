-- MODE-VISITEUR-OFFLINE : snapshot des données de contenu en 1 jsonb.
-- STABLE => appelable en GET via PostgREST (/rest/v1/rpc/snapshot_visiteur).
-- SECURITY INVOKER (défaut) => l'appelant anon voit exactement ce que la RLS lui montre
-- (parité stricte avec ce que l'app peut lire).
CREATE OR REPLACE FUNCTION public.snapshot_visiteur()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
WITH t AS (
  SELECT jsonb_build_object(
    'races',                (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM races x),
    'race_traits',          (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM race_traits x),
    'traits_raciaux',       (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM traits_raciaux x),
    'classes',              (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM classes x),
    'competences',          (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM competences x),
    'sorts',                (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM sorts x),
    'prieres',              (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM prieres x),
    'religions',            (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM religions x),
    'langues',              (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM langues x),
    'familles_criminelles', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM familles_criminelles x),
    'categories_creatures', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM categories_creatures x),
    'assemblages_runes',    (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM assemblages_runes x),
    'recettes_alchimie',    (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM recettes_alchimie x),
    'pieges',               (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM pieges x),
    'objets_forge',         (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM objets_forge x),
    'objets_joaillerie',    (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM objets_joaillerie x),
    'parametres_jeu',       (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM parametres_jeu x)
  ) AS tables
)
SELECT jsonb_build_object(
  'manifest', jsonb_build_object(
    'genere_le', now(),
    'comptes', (SELECT jsonb_object_agg(k.k, jsonb_array_length(t.tables->k.k))
                FROM jsonb_object_keys(t.tables) k(k))
  ),
  'tables', t.tables
)
FROM t;
$fn$;

REVOKE ALL ON FUNCTION public.snapshot_visiteur() FROM public;
GRANT EXECUTE ON FUNCTION public.snapshot_visiteur() TO anon, authenticated;
