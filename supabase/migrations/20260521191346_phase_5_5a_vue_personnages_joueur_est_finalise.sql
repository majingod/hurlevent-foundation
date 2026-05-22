-- ============================================================================
-- Sprint 5.5 — Phase A (PR0)
-- ============================================================================
-- Régénère vue_personnages_joueur pour exposer la colonne est_finalise
-- (ajoutée à la table personnages en Sprint 5.1 / Migration 5.1).
--
-- Préalable au badge "Finalisé" du tableau de bord (Sprint 5.5 Section 6).
--
-- Contraintes :
--  - CREATE OR REPLACE VIEW exige que les colonnes existantes gardent leur
--    ordre ; est_finalise est donc ajouté en DERNIÈRE position (après
--    classe_nom).
--  - security_invoker = true conservé pour respecter les RLS de personnages.
-- ============================================================================

CREATE OR REPLACE VIEW public.vue_personnages_joueur
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.joueur_id,
  p.nom,
  p.niveau,
  p.xp_total,
  p.xp_depense,
  p.etape_creation,
  p.est_actif,
  p.created_at,
  COALESCE(r.nom, 'Race inconnue'::text) AS race_nom,
  COALESCE(c.nom, 'Classe inconnue'::text) AS classe_nom,
  p.est_finalise
FROM personnages p
LEFT JOIN races r ON r.id = p.race_id
LEFT JOIN classes c ON c.id = p.classe_id
WHERE p.est_actif = true;

COMMENT ON VIEW public.vue_personnages_joueur IS
  'Liste des personnages actifs d''un joueur, avec race_nom et classe_nom hydratés. est_finalise exposé depuis Sprint 5.5 pour le badge tableau de bord.';
