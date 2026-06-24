-- Arme de jet (Projectile ≤30 cm) = réparable → mapper à la ligne réparation « Projectile ».
-- Arc / Arbalète reste NON réparable (reparation_id NULL, inchangé). Idempotent.
UPDATE objets_forge o
SET reparation_id = r.id
FROM reparations_forge r
WHERE o.nom = 'Arme de jet'
  AND r.categorie = 'arme'
  AND r.nom_affichage = 'Projectile'
  AND o.reparation_id IS DISTINCT FROM r.id;
