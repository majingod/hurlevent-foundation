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
  (
    SELECT (n->>'description')::text
    FROM jsonb_array_elements(comp.niveaux) n
    WHERE (n->>'niveau')::int = pc.niveau_acquis
    LIMIT 1
  ) AS description_niveau_acquis
FROM personnage_competences pc
  JOIN competences comp ON comp.id = pc.competence_id;
