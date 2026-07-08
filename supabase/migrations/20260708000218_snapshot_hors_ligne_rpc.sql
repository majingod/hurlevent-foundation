-- RPC publique : snapshot complet du contenu public (règles + encyclopédie + créateur)
-- Source unique pour : (a) le bake build-time du fichier hors-ligne, (b) l'injection
-- de données fraîches au moment du téléchargement. Miroir des filtres du front
-- (est_actif = true là où la colonne existe). Lecture seule, données déjà
-- accessibles à anon via RLS → aucune exposition nouvelle.
-- ⚠️ HISTORIQUE : cette RPC est un DOUBLON du patron maison snapshot_visiteur(),
-- créé avant scan — droppée par 20260708000611. Conservée pour traçabilité.
CREATE OR REPLACE FUNCTION public.rpc_snapshot_hors_ligne()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fnsnap$
DECLARE
  v_tables jsonb;
  v_comptes jsonb;
BEGIN
  v_tables := jsonb_build_object(
    'assemblages_runes', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM assemblages_runes t WHERE t.est_actif),
    'bestiaire', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM bestiaire t WHERE t.est_actif),
    'categories_creatures', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM categories_creatures t WHERE t.est_actif),
    'classes', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM classes t WHERE t.est_actif),
    'competences', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM competences t WHERE t.est_actif),
    'effets_combat', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM effets_combat t),
    'familles_criminelles', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM familles_criminelles t WHERE t.est_actif),
    'fiches_listes', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM fiches_listes t),
    'fiches_schemas', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM fiches_schemas t),
    'langues', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM langues t WHERE t.est_actif),
    'lore', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM lore t WHERE t.est_actif),
    'objets_forge', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM objets_forge t WHERE t.est_actif),
    'objets_joaillerie', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM objets_joaillerie t WHERE t.est_actif),
    'parametres_jeu', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM parametres_jeu t),
    'pieges', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM pieges t WHERE t.est_actif),
    'prieres', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM prieres t WHERE t.est_actif),
    'race_traits', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) FROM race_traits t),
    'races', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM races t WHERE t.est_actif),
    'recettes_alchimie', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM recettes_alchimie t WHERE t.est_actif),
    'religions', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM religions t WHERE t.est_actif),
    'reparations_forge', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM reparations_forge t WHERE t.est_actif),
    'sections_regles', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.categorie, t.ordre), '[]'::jsonb) FROM sections_regles t WHERE t.est_actif),
    'sorts', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM sorts t WHERE t.est_actif),
    'traits_raciaux', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM traits_raciaux t WHERE t.est_actif),
    'vue_competences_encyclopedie', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.nom), '[]'::jsonb) FROM vue_competences_encyclopedie t WHERE t.est_actif)
  );

  SELECT jsonb_object_agg(cle, jsonb_array_length(valeur))
    INTO v_comptes
    FROM jsonb_each(v_tables) AS e(cle, valeur);

  RETURN jsonb_build_object(
    'manifest', jsonb_build_object(
      'genere_le', now(),
      'source', 'rpc_snapshot_hors_ligne',
      'comptes', v_comptes
    ),
    'tables', v_tables
  );
END;
$fnsnap$;

COMMENT ON FUNCTION public.rpc_snapshot_hors_ligne() IS
'Snapshot jsonb du contenu public (25 tables : créateur + règles + encyclopédie) pour la version hors-ligne. Filtres miroir du front (est_actif). Consommée par le script de bake build-time et par la page de téléchargement (données fraîches).';

GRANT EXECUTE ON FUNCTION public.rpc_snapshot_hors_ligne() TO anon, authenticated;
