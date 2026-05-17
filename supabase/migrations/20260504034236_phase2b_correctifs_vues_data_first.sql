-- ============================================================================
-- PHASE 2b — CORRECTIFS DES VUES DATA-FIRST
-- ============================================================================
-- Date     : 2026-05-04
-- Contexte : Ajoute les colonnes manquantes nécessaires à Etape_Recapitulatif
--            et au Etape_TraitsRaciaux.
--
-- Note     : vue_traits_par_race est ENRICHIE et non remplacée. La version
--            existante en prod expose 9 colonnes (race_trait_id, race_nom,
--            est_actif, etc.) que du code peut déjà utiliser. On préserve
--            ces colonnes et on ajoute juste le filtre est_actif = true en SQL.
-- ============================================================================

-- 1. vue_competences_personnage — ajout de competence_description
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
  comp.categorie,
  comp.description AS competence_description
FROM personnage_competences pc
JOIN competences comp ON comp.id = pc.competence_id;
ALTER VIEW public.vue_competences_personnage SET (security_invoker = true);

-- 2. vue_assemblages_personnage — ajout de xp_depense
DROP VIEW IF EXISTS public.vue_assemblages_personnage CASCADE;
CREATE VIEW public.vue_assemblages_personnage AS
SELECT
  pa.id,
  pa.personnage_id,
  pa.xp_depense,
  ar.nom,
  ar.cible,
  ar.cout_ps,
  ar.description,
  ar.effet,
  ar.runes_requises
FROM personnage_assemblages pa
JOIN assemblages_runes ar ON ar.id = pa.assemblage_id;
ALTER VIEW public.vue_assemblages_personnage SET (security_invoker = true);

-- 3. vue_recettes_personnage — ajout de xp_depense
DROP VIEW IF EXISTS public.vue_recettes_personnage CASCADE;
CREATE VIEW public.vue_recettes_personnage AS
SELECT
  pr.id,
  pr.personnage_id,
  pr.xp_depense,
  ra.nom,
  ra.type,
  ra.niveau_requis,
  ra.description,
  ra.effet
FROM personnage_recettes pr
JOIN recettes_alchimie ra ON ra.id = pr.recette_id;
ALTER VIEW public.vue_recettes_personnage SET (security_invoker = true);

-- 4. vue_traits_par_race — VERSION ENRICHIE (préserve toutes les colonnes
--    existantes + ajoute le filtre est_actif = true en SQL pour éviter
--    le filtrage côté client dans Etape_TraitsRaciaux.tsx)
DROP VIEW IF EXISTS public.vue_traits_par_race CASCADE;
CREATE VIEW public.vue_traits_par_race AS
SELECT
  rt.id          AS race_trait_id,
  rt.race_id,
  rt.trait_id,
  rt.sous_type,
  r.nom          AS race_nom,
  tr.nom         AS trait_nom,
  tr.description AS trait_description,
  tr.cout_xp,
  tr.est_actif
FROM race_traits rt
JOIN races          r  ON r.id  = rt.race_id
JOIN traits_raciaux tr ON tr.id = rt.trait_id
WHERE tr.est_actif = true
ORDER BY r.nom, rt.sous_type, tr.nom;
ALTER VIEW public.vue_traits_par_race SET (security_invoker = true);
