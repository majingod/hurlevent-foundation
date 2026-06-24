-- FICHES-ARTISANAT-BLOCS-MÉTA (s277) — étape (a), prod-first, idempotent.
-- reparations_forge existe déjà (avril 2026, 11 lignes, consommée par encyclo/wizard/fiche).
-- Ici : corriger l'erreur "/PA" bouclier (tranchée s276) + coquille borne arme longue,
-- puis lier chaque objet_forge à sa ligne de réparation (NULL pour jet/arc/hast/accessoires).

-- 1) Correction "/PA" bouclier (erreur manuel — pas de scaling par point d'armure)
UPDATE reparations_forge
SET materiaux        = '1 pépite métal + 1 pépite fer',
    materiaux_rares  = '1 pépite orichalcum',
    notes            = NULL,
    updated_at       = now()
WHERE categorie = 'bouclier'
  AND (materiaux ILIKE '%par PA%' OR materiaux_rares ILIKE '%par PA%' OR notes IS NOT NULL);

-- 2) Coquille borne "Arme longue (≤200 cm)" → borne réelle du manuel
UPDATE reparations_forge
SET nom_affichage = 'Arme longue (80–110 cm)', updated_at = now()
WHERE categorie = 'arme'
  AND nom_affichage LIKE 'Arme longue%'
  AND nom_affichage <> 'Arme longue (80–110 cm)';

-- 3) Colonne de liaison objet → ligne de réparation (additive, nullable, FK)
ALTER TABLE objets_forge
  ADD COLUMN IF NOT EXISTS reparation_id uuid REFERENCES reparations_forge(id);

-- 4) Mapping explicite. 5 armes + 3 armures + 3 boucliers.
--    NON mappés (restent NULL) : Arme de jet, Arc/Arbalète, Arme d'hast (en attente animation),
--    et les 6 accessoires d'armure (Q1/Q2 = B, Fred s277).
UPDATE objets_forge o
SET reparation_id = r.id
FROM (VALUES
  ('Arme légère',             'Arme légère (≤45 cm)'),
  ('Arme moyenne',            'Arme moyenne (45–80 cm)'),
  ('Arme longue',             'Arme longue (80–110 cm)'),
  ('Arme lourde',             'Arme lourde (110–160 cm)'),
  ('Projectile',              'Projectile'),
  ('Armure de cuir',          'Armure de cuir'),
  ('Armure de maille',        'Armure de maille'),
  ('Armure de plaques',       'Armure de plaques'),
  ('Bouclier petit',          'Petit bouclier'),
  ('Bouclier moyen',          'Bouclier moyen'),
  ('Bouclier grand / Pavois', 'Grand bouclier / Pavois')
) AS m(nom_objet, nom_rep)
JOIN reparations_forge r ON r.nom_affichage = m.nom_rep
WHERE o.nom = m.nom_objet
  AND o.reparation_id IS DISTINCT FROM r.id;
