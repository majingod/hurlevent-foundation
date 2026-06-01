-- Enrichit vue_recettes_personnage : expose formule + ingredients (jsonb)
-- pour permettre l'affichage complet des recettes sur la fiche personnage.
-- Non-breaking : ajoute 2 colonnes en fin, conserve l'ordre existant.
CREATE OR REPLACE VIEW public.vue_recettes_personnage AS
SELECT
  pr.id,
  pr.personnage_id,
  pr.xp_depense,
  ra.nom,
  ra.type,
  ra.niveau_requis,
  ra.description,
  ra.effet,
  ra.formule,
  ra.ingredients
FROM personnage_recettes pr
JOIN recettes_alchimie ra ON ra.id = pr.recette_id;
