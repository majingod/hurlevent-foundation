-- AUDIT-MANUEL Phase 2 bloc F — points C validés par Fred (2026-06-11)
-- PC-F2 : manipulation du Palos dans le Remède curatif : « réchauffé » -> « activé par un souffle »
--         (alignement sur ingredients_alchimiques.manipulations, source de vérité)
-- PC-F4 : Assemblage de durabilité : cible « Un bouclier » -> « Un bouclier ou une arme »
-- Idempotent : les deux UPDATE sont sans effet s'ils ont déjà été appliqués.

UPDATE recettes_alchimie
SET ingredients = jsonb_set(ingredients, '{manipulations}',
  (SELECT jsonb_agg(CASE WHEN e = 'Palos réchauffé' THEN to_jsonb('Palos activé par un souffle'::text) ELSE to_jsonb(e) END)
   FROM jsonb_array_elements_text(ingredients->'manipulations') AS e))
WHERE nom = 'Remède curatif'
  AND ingredients->'manipulations' @> '["Palos réchauffé"]'::jsonb;

UPDATE assemblages_runes
SET cible = 'Un bouclier ou une arme'
WHERE nom = 'Assemblage de durabilité'
  AND cible = 'Un bouclier';
