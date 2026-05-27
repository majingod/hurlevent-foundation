-- Phase PR-A v39 : enrichissement vue_competences_personnage
-- Ajout de 3 colonnes nécessaires au refactor compétences React (Patterns 1 & 2) :
--   - competence_id : clé de grouping côté frontend
--   - type_achat    : branchement Pattern 1 ('simple') vs Pattern 2 ('multiple_sans_choix')
--   - niveau_max    : dérivé du JSONB niveaux (utilisé pour afficher "niveau X/Y")
-- Ordre : append à la fin pour préserver la dépendance vue_personnage_creation_complet.

CREATE OR REPLACE VIEW public.vue_competences_personnage AS
SELECT
  pc.id,
  pc.personnage_id,
  pc.niveau_acquis,
  pc.xp_depense,
  pc.choix_achat,
  pc.appris_via_maitre,
  pc.nom_maitre,
  COALESCE(pc.statut_maitre, 'non_requis'::text) AS statut_maitre,
  comp.nom,
  comp.categorie,
  comp.description AS competence_description,
  (SELECT n.value->>'description'
     FROM jsonb_array_elements(comp.niveaux) n
     WHERE ((n.value->>'niveau')::int) = pc.niveau_acquis
     LIMIT 1
  ) AS description_niveau_acquis,
  -- 3 nouvelles colonnes (PR-A v39)
  pc.competence_id,
  comp.type_achat,
  (SELECT MAX((n.value->>'niveau')::int)
     FROM jsonb_array_elements(comp.niveaux) n
  ) AS niveau_max
FROM personnage_competences pc
JOIN competences comp ON comp.id = pc.competence_id;
