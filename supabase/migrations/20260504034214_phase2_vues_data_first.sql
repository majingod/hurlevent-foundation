-- ============================================================================
-- PHASE 2 — VUES DATA-FIRST (8 vues)
-- ============================================================================
-- Date     : 2026-05-04
-- Contexte : Reconstruction data-first du créateur. Ces vues éliminent les
--            jointures et les boucles N+1 côté frontend en exposant les
--            données déjà jointes et formatées.
--
-- Source   : Migration héritée du repo (20260503000001_phase2_vues_data_first.sql)
--            jamais appliquée en prod. Réappliquée ici pour réaligner le repo
--            et la prod.
-- ============================================================================

-- 1. vue_evenements_publies
DROP VIEW IF EXISTS public.vue_evenements_publies CASCADE;
CREATE VIEW public.vue_evenements_publies AS
SELECT
  e.id,
  e.titre,
  e.date_evenement,
  e.date_fin,
  e.lieu,
  e.type_evenement,
  e.xp_recompense,
  e.max_participants,
  e.description,
  COALESCE((
    SELECT COUNT(*)::int
    FROM inscriptions_evenements ie
    WHERE ie.evenement_id = e.id
      AND ie.statut IN ('en_attente', 'present')
  ), 0) AS nb_inscrits
FROM evenements e
WHERE e.est_publie = true
ORDER BY e.date_evenement ASC;
ALTER VIEW public.vue_evenements_publies SET (security_invoker = true);

-- 2. vue_personnages_joueur
DROP VIEW IF EXISTS public.vue_personnages_joueur CASCADE;
CREATE VIEW public.vue_personnages_joueur AS
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
  COALESCE(r.nom, 'Race inconnue') AS race_nom,
  COALESCE(c.nom, 'Classe inconnue') AS classe_nom
FROM personnages p
LEFT JOIN races r ON r.id = p.race_id
LEFT JOIN classes c ON c.id = p.classe_id
WHERE p.est_actif = true;
ALTER VIEW public.vue_personnages_joueur SET (security_invoker = true);

-- 3. vue_fiche_personnage
DROP VIEW IF EXISTS public.vue_fiche_personnage CASCADE;
CREATE VIEW public.vue_fiche_personnage AS
SELECT
  p.id,
  p.nom,
  p.niveau,
  p.xp_total,
  p.xp_depense,
  p.pv_max,
  p.ps_max,
  p.historique,
  p.ame_personnage,
  p.joueur_id,
  p.race_id,
  p.classe_id,
  p.religion_id,
  p.gn_completes,
  p.mini_gn_completes,
  p.ouvertures_terrain,
  p.traits_raciaux_choisis,
  p.est_actif,
  p.est_mort,
  r.nom       AS race_nom,
  r.nom_latin AS race_nom_latin,
  c.nom       AS classe_nom,
  rel.nom     AS religion_nom
FROM personnages p
LEFT JOIN races     r   ON r.id   = p.race_id
LEFT JOIN classes   c   ON c.id   = p.classe_id
LEFT JOIN religions rel ON rel.id = p.religion_id;
ALTER VIEW public.vue_fiche_personnage SET (security_invoker = true);

-- 4. vue_competences_personnage
DROP VIEW IF EXISTS public.vue_competences_personnage CASCADE;
CREATE VIEW public.vue_competences_personnage AS
SELECT
  pc.id,
  pc.personnage_id,
  pc.niveau_acquis,
  pc.xp_depense,
  pc.choix_achat,
  pc.appris_via_maitre,
  pc.nom_maitre,
  COALESCE(pc.statut_maitre, 'non_requis') AS statut_maitre,
  comp.nom,
  comp.categorie
FROM personnage_competences pc
JOIN competences comp ON comp.id = pc.competence_id;
ALTER VIEW public.vue_competences_personnage SET (security_invoker = true);

-- 5. vue_sorts_personnage
DROP VIEW IF EXISTS public.vue_sorts_personnage CASCADE;
CREATE VIEW public.vue_sorts_personnage AS
SELECT
  ps.id,
  ps.personnage_id,
  ps.nom_personnalise,
  ps.formule_magique,
  ps.niveau_sort,
  ps.zone_choisie,
  ps.portee_choisie,
  ps.duree_choisie,
  s.cercle,
  s.cout_xp_base,
  s.nom         AS sort_nom_base,
  s.description AS sort_description
FROM personnage_sorts ps
JOIN sorts s ON s.id = ps.sort_id;
ALTER VIEW public.vue_sorts_personnage SET (security_invoker = true);

-- 6. vue_prieres_personnage
DROP VIEW IF EXISTS public.vue_prieres_personnage CASCADE;
CREATE VIEW public.vue_prieres_personnage AS
SELECT
  pp.id,
  pp.personnage_id,
  pp.nom_personnalise,
  pp.niveau_priere,
  pp.zone_choisie,
  pp.portee_choisie,
  pp.duree_choisie,
  pr.domaine,
  pr.description    AS priere_description,
  pr.duree_incantation,
  pr.cout_xp_base
FROM personnage_prieres pp
JOIN prieres pr ON pr.id = pp.priere_id;
ALTER VIEW public.vue_prieres_personnage SET (security_invoker = true);

-- 7. vue_assemblages_personnage
DROP VIEW IF EXISTS public.vue_assemblages_personnage CASCADE;
CREATE VIEW public.vue_assemblages_personnage AS
SELECT
  pa.id,
  pa.personnage_id,
  ar.nom,
  ar.cible,
  ar.cout_ps,
  ar.description,
  ar.effet,
  ar.runes_requises
FROM personnage_assemblages pa
JOIN assemblages_runes ar ON ar.id = pa.assemblage_id;
ALTER VIEW public.vue_assemblages_personnage SET (security_invoker = true);

-- 8. vue_recettes_personnage
DROP VIEW IF EXISTS public.vue_recettes_personnage CASCADE;
CREATE VIEW public.vue_recettes_personnage AS
SELECT
  pr.id,
  pr.personnage_id,
  ra.nom,
  ra.type,
  ra.niveau_requis,
  ra.description,
  ra.effet
FROM personnage_recettes pr
JOIN recettes_alchimie ra ON ra.id = pr.recette_id;
ALTER VIEW public.vue_recettes_personnage SET (security_invoker = true);
