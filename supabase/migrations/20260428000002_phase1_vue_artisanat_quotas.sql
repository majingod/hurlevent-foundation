-- Phase 1 — Tâche 1.3 : Mise à jour de vue_artisanat_quotas
-- Expose les quotas par niveau d'alchimie et le compteur d'utilisés

DROP VIEW IF EXISTS public.vue_artisanat_quotas CASCADE;

CREATE VIEW public.vue_artisanat_quotas AS
SELECT
  e.personnage_id,
  e.niveau_alchimie,
  e.niveau_forge,
  e.niveau_joaillerie,
  e.niveau_runes,
  e.a_forge_legendaire,
  e.a_joaillerie_legendaire,

  -- Quota recettes total cumulé (rétrocompat)
  CASE
    WHEN e.niveau_alchimie >= 3 THEN 12
    WHEN e.niveau_alchimie >= 2 THEN 9
    WHEN e.niveau_alchimie >= 1 THEN 5
    ELSE 0
  END AS quota_recettes_total,

  -- Quota assemblages total (rétrocompat)
  CASE
    WHEN e.niveau_runes >= 3 THEN 5
    WHEN e.niveau_runes >= 2 THEN 4
    WHEN e.niveau_runes >= 1 THEN 2
    ELSE 0
  END AS quota_assemblages_total,

  -- Quotas alchimie par niveau
  CASE WHEN e.niveau_alchimie >= 1 THEN 5 ELSE 0 END AS quota_alchimie_mineure_total,
  CASE WHEN e.niveau_alchimie >= 2 THEN 4 ELSE 0 END AS quota_alchimie_intermediaire_total,
  CASE WHEN e.niveau_alchimie >= 3 THEN 3 ELSE 0 END AS quota_alchimie_majeure_total,

  -- Compteurs utilisés alchimie (recettes gratuites déjà choisies)
  COALESCE((
    SELECT COUNT(*)::int
    FROM personnage_recettes pr
    JOIN recettes_alchimie ra ON ra.id = pr.recette_id
    WHERE pr.personnage_id = e.personnage_id
      AND pr.est_gratuit = true
      AND ra.niveau_requis = 1
  ), 0) AS quota_alchimie_mineure_utilises,

  COALESCE((
    SELECT COUNT(*)::int
    FROM personnage_recettes pr
    JOIN recettes_alchimie ra ON ra.id = pr.recette_id
    WHERE pr.personnage_id = e.personnage_id
      AND pr.est_gratuit = true
      AND ra.niveau_requis = 2
  ), 0) AS quota_alchimie_intermediaire_utilises,

  COALESCE((
    SELECT COUNT(*)::int
    FROM personnage_recettes pr
    JOIN recettes_alchimie ra ON ra.id = pr.recette_id
    WHERE pr.personnage_id = e.personnage_id
      AND pr.est_gratuit = true
      AND ra.niveau_requis = 3
  ), 0) AS quota_alchimie_majeure_utilises,

  -- Compteur utilisés assemblages (assemblages gratuits déjà choisis)
  COALESCE((
    SELECT COUNT(*)::int
    FROM personnage_assemblages pa
    WHERE pa.personnage_id = e.personnage_id
      AND pa.est_gratuit = true
  ), 0) AS quota_assemblages_utilises

FROM public.vue_artisanat_etat e;

ALTER VIEW public.vue_artisanat_quotas SET (security_invoker = true);
