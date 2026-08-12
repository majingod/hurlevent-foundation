-- s395 · L'Encyclopédie dit le COÛT d'une réparation, plus seulement son nom.
--
-- Le champ « Réparation » de la catégorie forge affichait row[relation.affiche],
-- soit UNE colonne : nom_affichage. Sur un Grand bouclier / Pavois, cela donnait
-- « Réparation : Grand bouclier / Pavois » — l'étiquette nommait une chose et en
-- montrait une autre (C104). Les trois autres écrans (étape 9 du créateur, fiche
-- de personnage, fiche imprimable) affichent depuis toujours « temps · matériaux ».
--
-- On ajoute un GABARIT optionnel à la relation. Le moteur (FicheMoteur2) rend le
-- gabarit s'il est présent, et retombe sur relation.affiche sinon.
-- ⭐ Rétro-compatible PAR CONSTRUCTION : « forme: fk » n'existe QUE pour forge
-- (mesuré : forge = fk, competences = par_niveau). Aucune autre catégorie ne peut
-- être atteinte par ce changement.
--
-- ⛔ AUCUNE donnée de réparation n'est dupliquée ici : le gabarit nomme des
-- COLONNES de reparations_forge, il n'en recopie aucune valeur (#30, une maison).
--
-- REPLI, un geste : retirer les 3 clés du gabarit.
--   UPDATE public.fiches_schemas s SET champs_v2 = (
--     SELECT jsonb_agg(CASE WHEN c->>'cle' = 'reparation'
--       THEN jsonb_set(c, '{relation}', (c->'relation') - 'gabarit' - 'gabarit_rare' - 'titre_rare')
--       ELSE c END ORDER BY ord)
--     FROM jsonb_array_elements(s.champs_v2) WITH ORDINALITY t(c, ord))
--   WHERE s.categorie = 'forge';
-- Idempotente.

UPDATE public.fiches_schemas s
SET champs_v2 = (
  SELECT jsonb_agg(
    CASE WHEN c->>'cle' = 'reparation'
      THEN jsonb_set(c, '{relation}', (c->'relation') || jsonb_build_object(
             'gabarit',      '{temps_minutes} min · {materiaux}',
             'gabarit_rare', '{temps_rare_minutes} min · {materiaux_rares}',
             'titre_rare',   'Rare'))
      ELSE c END
    ORDER BY ord)
  FROM jsonb_array_elements(s.champs_v2) WITH ORDINALITY t(c, ord)
)
WHERE s.categorie = 'forge'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(s.champs_v2) c
    WHERE c->>'cle' = 'reparation' AND c->'relation'->'gabarit' IS NULL);
