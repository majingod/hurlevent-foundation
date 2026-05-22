-- ============================================================
-- Migration : enrichir vue_fiche_personnage.traits_raciaux_choisis
-- Date : 22 mai 2026 (session 25)
-- Objectif : résoudre le bug "onglet Traits vide" dans PersonnageFiche.tsx
--
-- Avant : la vue retournait traits_raciaux_choisis brut depuis personnages,
--         format [{trait_id, xp_depense, est_gratuit, ...}]
--         → le frontend caste en Trait[] et accède à trait.nom (undefined)
--           → cards vides
--
-- Après : la vue enrichit en jointure avec traits_raciaux pour fournir
--         [{id, nom, description, cout_xp, xp_depense, est_gratuit}, ...]
--         → le cast frontend continue de fonctionner, les noms/descriptions
--           s'affichent correctement.
--
-- Impact périmètre :
--   - vue_fiche_personnage : SEUL consommateur frontend = PersonnageFiche.tsx
--   - personnages.traits_raciaux_choisis (table) : INCHANGÉE — garde le
--     format brut pour Etape3_V2 et RPC sauvegarder_etape_3.
--   - Asymétrie tolérée : table = brut (write), vue = enrichi (read).
-- ============================================================

CREATE OR REPLACE VIEW vue_fiche_personnage AS
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
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', tr.id,
        'nom', tr.nom,
        'description', tr.description,
        'cout_xp', tr.cout_xp,
        'xp_depense', (t->>'xp_depense')::int,
        'est_gratuit', (t->>'est_gratuit')::boolean
      ) ORDER BY tr.nom
    )
    FROM jsonb_array_elements(p.traits_raciaux_choisis) AS t
    LEFT JOIN traits_raciaux tr ON tr.id = (t->>'trait_id')::uuid
  ), '[]'::jsonb) AS traits_raciaux_choisis,
  p.est_actif,
  p.est_mort,
  r.nom AS race_nom,
  r.nom_latin AS race_nom_latin,
  c.nom AS classe_nom,
  rel.nom AS religion_nom
FROM personnages p
LEFT JOIN races r ON r.id = p.race_id
LEFT JOIN classes c ON c.id = p.classe_id
LEFT JOIN religions rel ON rel.id = p.religion_id;
