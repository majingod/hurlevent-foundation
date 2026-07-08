-- Extension de la RPC maison snapshot_visiteur() : +7 sources pour la version
-- hors-ligne complète (règles + encyclopédie) → 25 clés au total.
-- Style maison préservé : LANGUAGE sql, STABLE, SECURITY INVOKER (parité RLS
-- stricte — anon voit exactement ce que l'app peut lire), AUCUN filtre métier
-- dans la RPC (est_actif se filtre côté client, comme les requêtes du front),
-- tri uniforme par ->>'id' (::text pour fiches_schemas/fiches_listes sans id).
-- Vérifié : les 7 nouvelles sources sont lisibles par anon (comptes identiques
-- au rôle admin), donc l'invoker les expose intégralement.
CREATE OR REPLACE FUNCTION public.snapshot_visiteur()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
    'reparations_forge',    (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM reparations_forge x),
    'parametres_jeu',       (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM parametres_jeu x),
    -- Extension hors-ligne (règles + encyclopédie)
    'sections_regles',      (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM sections_regles x),
    'effets_combat',        (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM effets_combat x),
    'bestiaire',            (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM bestiaire x),
    'lore',                 (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM lore x),
    'fiches_schemas',       (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM fiches_schemas x),
    'fiches_listes',        (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM fiches_listes x),
    'vue_competences_encyclopedie', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM vue_competences_encyclopedie x)
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
$function$;

COMMENT ON FUNCTION public.snapshot_visiteur() IS
'Snapshot jsonb du contenu public (25 clés : créateur + règles + encyclopédie). SECURITY INVOKER : parité RLS stricte. Aucun filtre métier (est_actif se filtre côté client). Consommée par scripts/snapshot-visiteur.mjs (bake build-time) et par la page de téléchargement hors-ligne (données fraîches au clic).';

-- Nettoyage : doublon créé plus tôt aujourd'hui (s312) avant scan du patron
-- maison — snapshot_visiteur() est LA source unique.
DROP FUNCTION IF EXISTS public.rpc_snapshot_hors_ligne();
