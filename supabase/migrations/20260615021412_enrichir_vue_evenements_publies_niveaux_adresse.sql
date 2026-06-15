-- Enrichit vue_evenements_publies : ajoute niveaux_recompense + adresse_physique
-- (additif, en fin de SELECT pour respecter CREATE OR REPLACE VIEW).
-- Appliqué prod-first via MCP (version 20260615021412).
CREATE OR REPLACE VIEW public.vue_evenements_publies AS
SELECT
  id,
  titre,
  date_evenement,
  date_fin,
  lieu,
  type_evenement,
  xp_recompense,
  max_participants,
  description,
  COALESCE((
    SELECT count(*)::integer
    FROM inscriptions_evenements ie
    WHERE ie.evenement_id = e.id
      AND ie.statut = ANY (ARRAY['en_attente'::text, 'present'::text])
  ), 0) AS nb_inscrits,
  niveaux_recompense,
  adresse_physique
FROM evenements e
WHERE est_publie = true
ORDER BY date_evenement;
