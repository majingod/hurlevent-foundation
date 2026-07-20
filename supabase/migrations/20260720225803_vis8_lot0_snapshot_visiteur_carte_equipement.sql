-- VIS-8 lot 0 (s347) : le snapshot visiteur embarque la carte équipement
-- (objets_generateur + objets_requis) → le générateur hors ligne lira les
-- mêmes règles que le mode connecté, sans travail au déploiement.
-- Rejoue snapshot_visiteur() (idempotent), même patron que 20260708065026
-- (ingredients_alchimiques) : corps EXTRAIT du .sql du repo, insertion
-- ancrée des 2 clés (jamais retapé — Gotcha C46).
-- ⚠️ CREATE OR REPLACE réinitialise l'ACL à PUBLIC → re-verrouillage en fin
-- de fichier (état mesuré s347 : anon + authenticated + service_role,
-- pas de PUBLIC).
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
    'ingredients_alchimiques', (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM ingredients_alchimiques x),
    'pieges',               (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM pieges x),
    'objets_forge',         (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM objets_forge x),
    'objets_joaillerie',    (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM objets_joaillerie x),
    'reparations_forge',    (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM reparations_forge x),
    'parametres_jeu',       (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM parametres_jeu x),
    -- Lot 0 générateur (s347) : carte équipement ↔ compétences/races
    'objets_generateur',    (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM objets_generateur x),
    'objets_requis',        (SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)->>'id'),'[]'::jsonb) FROM objets_requis x),
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

REVOKE EXECUTE ON FUNCTION public.snapshot_visiteur() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snapshot_visiteur() TO anon, authenticated, service_role;
